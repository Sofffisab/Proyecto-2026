import bcrypt from "bcrypt";
import { prisma, redis } from "../config/index.js";
import { calculateAge } from "../utils/age.js";

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

export async function getById(id, callerRole = "USER", callerId = null) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { trainerProfile: true, settings: true },
  });

  if (!user) return null;

  // passwordHash is NEVER returned regardless of caller role
  const { passwordHash, passwordResetToken, passwordResetExpires, ...base } = user;

  // Own profile: the owner always sees their own full data. `age` is never
  // stored — always derived on read from `birthday` (see utils/age.js), same
  // convention as the birthday-greeting job.
  if (callerId && callerId === id) {
    return { ...base, age: calculateAge(base.birthday) };
  }

  // Fragile personal data (medical info, exact address) is never handed to
  // anyone else automatically — not even admins. There is no flag or query
  // param that unlocks it here; when a trainer legitimately needs it during
  // an active assistance, it's fetched through the purpose-built Ayudar flow
  // (gym.service.js), which is scoped and logged, not through this lookup.
  if (callerRole === "ADMIN") {
    const { medicalConditions, deliveryAddress, ...adminSafe } = base;
    return adminSafe;
  }

  // Trainers and regular users viewing someone else don't see sensitive
  // personal fields at all.
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
  const { passwordHash, role, isActive, isProfileComplete, ...safeData } = data;

  const current = await prisma.user.findUnique({
    where: { id },
    select: { birthday: true, medicalConditions: true, deliveryAddress: true },
  });

  const merged = { ...current, ...safeData };
  const profileComplete = Boolean(merged.birthday) && merged.medicalConditions != null && Boolean(merged.deliveryAddress);

  return prisma.user.update({
    where: { id },
    data: { ...safeData, isProfileComplete: profileComplete },
  });
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

// Account deletion: auto-checks-out any active gym session, but refuses to
// delete while the user has unresolved assistance requests or active social
// challenges (those need to be resolved/cancelled first so the other side —
// trainer / partner — isn't left with a dangling reference).
export async function deleteUser(id) {
  const activeSession = await prisma.gymSession.findFirst({
    where: { userId: id, checkOutAt: null },
  });
  if (activeSession) {
    await prisma.gymSession.update({
      where: { id: activeSession.id },
      data: { checkOutAt: new Date() },
    });
  }

  const pendingAssistance = await prisma.assistance.findFirst({
    where: { userId: id, status: { in: ["PENDING", "ASSIGNED"] } },
  });
  if (pendingAssistance) {
    throw new Error("Cannot delete user with pending assistance requests. Resolve them first.");
  }

  const activeChallenge = await prisma.socialChallenge.findFirst({
    where: {
      OR: [{ userId: id }, { partnerId: id }],
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
  });
  if (activeChallenge) {
    throw new Error("Cannot delete user with active challenges. Complete or cancel them first.");
  }

  return prisma.user.delete({ where: { id } });
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
  const {
    disableAssistance,
    disableSocial,
    trainerPreference,
    machineTrackingOptOut,
    analyticsConsent,
  } = data;
  const safeData = {};
  if (disableAssistance !== undefined) safeData.disableAssistance = disableAssistance;
  if (disableSocial !== undefined) safeData.disableSocial = disableSocial;
  if (trainerPreference !== undefined) safeData.trainerPreference = trainerPreference;
  if (machineTrackingOptOut !== undefined) safeData.machineTrackingOptOut = machineTrackingOptOut;
  if (analyticsConsent !== undefined) safeData.analyticsConsent = analyticsConsent;

  return prisma.userSettings.upsert({
    where: { userId: id },
    update: safeData,
    create: { userId: id, ...safeData },
  });
}

// Upserts a trainer profile with the `specialties` array field
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



