import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import redis from "../config/redis.js";

export async function getAll({ limit = 20, offset = 0 } = {}) {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      trainerProfile: true,
    },
    take: limit,
    skip: offset,
  });
}

export async function getById(id, callerRole = "USER") {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { trainerProfile: true, settings: true },
  });

  if (!user) return null;

  // passwordHash is NEVER returned regardless of caller role
  const { passwordHash, passwordResetToken, passwordResetExpires, ...base } = user;

  if (callerRole === "ADMIN") {
    // Admins see everything except sensitive auth fields
    return base;
  }

  // Trainers and regular users don't see sensitive personal fields
  const { medicalConditions, objectives, deliveryAddress, ...safeUser } = base;
  return safeUser;
}

export async function getTrainers() {
  return prisma.user.findMany({
    where: { role: "TRAINER", isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
      trainerProfile: true,
    },
  });
}

export async function getTrainerById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { trainerProfile: true },
  });

  if (!user || user.role !== "TRAINER") return null;

  const {
    passwordHash,
    passwordResetToken,
    passwordResetExpires,
    medicalConditions,
    objectives,
    deliveryAddress,
    ...safeUser
  } = user;
  return safeUser;
}

export async function update(id, data) {
  // Prevent privilege escalation via update
  const { passwordHash, role, isActive, ...safeData } = data;
  return prisma.user.update({ where: { id }, data: safeData });
}

export async function updateFcmToken(id, fcmToken) {
  return prisma.user.update({ where: { id }, data: { fcmToken } });
}

export async function updateRole(id, role) {
  return prisma.user.update({ where: { id }, data: { role } });
}

export async function deactivateUser(id) {
  const user = await prisma.user.update({ where: { id }, data: { isActive: false } });
  if (redis) await redis.del(`user:${id}`);
  return user;
}

export async function changePassword(id, { currentPassword, newPassword }) {
  // bcrypt imported at top-level — not inside the function on every call
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  return prisma.user.update({ where: { id }, data: { passwordHash } });
}

export async function updateNotificationPreferences(id, data) {
  const { disableAssistance, disableSocial, trainerPreference } = data;
  const safeData = {};
  if (disableAssistance !== undefined) safeData.disableAssistance = disableAssistance;
  if (disableSocial !== undefined) safeData.disableSocial = disableSocial;
  if (trainerPreference !== undefined) safeData.trainerPreference = trainerPreference;

  return prisma.userSettings.upsert({
    where: { userId: id },
    update: safeData,
    create: { userId: id, ...safeData },
  });
}

export async function deleteUser(id) {
  // Check for active gym sessions
  const activeSession = await prisma.gymSession.findFirst({
    where: { userId: id, checkOutAt: null },
  });

  if (activeSession) {
    // Auto-checkout the session before deletion
    await prisma.gymSession.update({
      where: { id: activeSession.id },
      data: { checkOutAt: new Date() },
    });
  }

  // Check for pending assistance requests
  const pendingAssistance = await prisma.assistance.findFirst({
    where: { userId: id, status: { in: ["PENDING", "ASSIGNED"] } },
  });

  if (pendingAssistance) {
    throw new Error("Cannot delete user with pending assistance requests. Resolve them first.");
  }

  // Check for active challenges
  const activeChallenges = await prisma.socialChallenge.findFirst({
    where: {
      OR: [
        { userId: id, status: { in: ["ASSIGNED", "ACCEPTED"] } },
        { partnerUserId: id, status: { in: ["ASSIGNED", "ACCEPTED"] } },
      ],
    },
  });

  if (activeChallenges) {
    throw new Error("Cannot delete user with active challenges. Complete or cancel them first.");
  }

  // Safe to delete
  return prisma.user.delete({ where: { id } });
}
// Fix #11: upsert trainer profile with correct `specialties` array field
export async function upsertTrainerProfile(userId, specialtyOrData) {
  let specialties = [];
  if (Array.isArray(specialtyOrData)) {
    specialties = specialtyOrData;
  } else if (specialtyOrData && typeof specialtyOrData === "object") {
    specialties = specialtyOrData.specialties ?? [];
  } else if (specialtyOrData) {
    specialties = [specialtyOrData];
  }

  return prisma.trainerProfile.upsert({
    where: { userId },
    update: { specialties },
    create: { userId, specialties },
  });
}

// ============================================
// Cache-backed convenience API (userId-keyed Redis cache)
// ============================================

export async function getUserById(id) {
  const cacheKey = `user:${id}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");

  const { passwordHash, passwordResetToken, passwordResetExpires, ...safeUser } = user;

  if (redis) await redis.set(cacheKey, JSON.stringify(safeUser));

  return safeUser;
}

export async function updateProfile(id, data) {
  if (data.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== id) {
      throw new Error("Email already in use");
    }
  }

  const { passwordHash, role, isActive, ...safeData } = data;
  const user = await prisma.user.update({ where: { id }, data: safeData });

  if (redis) await redis.del(`user:${id}`);

  return user;
}

export async function changeRole(id, role) {
  const user = await prisma.user.update({ where: { id }, data: { role } });
  if (redis) await redis.del(`user:${id}`);
  return user;
}

export async function searchUsers({ query, limit = 20, offset = 0 } = {}) {
  return prisma.user.findMany({
    where: {
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    skip: offset,
  });
}

export async function getUsers({ limit = 20, offset = 0 } = {}) {
  return prisma.user.findMany({ take: limit, skip: offset });
}

