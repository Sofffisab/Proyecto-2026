import prisma from "../config/prisma.js";

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

  if (callerRole !== "ADMIN") {
    const { medicalConditions, objectives, deliveryAddress, passwordHash, ...safeUser } = user;
    return safeUser;
  }

  return user;
}

export async function update(id, data) {
  const { passwordHash, role, isActive, ...safeData } = data;
  return prisma.user.update({ where: { id }, data: safeData });
}

export async function updateRole(id, role) {
  return prisma.user.update({ where: { id }, data: { role } });
}

export async function deactivateUser(id) {
  return prisma.user.update({ where: { id }, data: { isActive: false } });
}

export async function changePassword(id, { currentPassword, newPassword }) {
  const bcrypt = await import("bcrypt");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.default.compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  const passwordHash = await bcrypt.default.hash(newPassword, 10);
  return prisma.user.update({ where: { id }, data: { passwordHash } });
}

export async function updateNotificationPreferences(id, data) {
  return prisma.userSettings.upsert({
    where: { userId: id },
    update: data,
    create: { userId: id, ...data },
  });
}