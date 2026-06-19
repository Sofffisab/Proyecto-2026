import prisma from "../config/prisma.js";

export async function getAll() {
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
  });
}

export async function getById(id, callerRole = 'USER') {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      trainerProfile: true,
      settings: true,
    },
  });

  if (!user) return null;

  // Only ADMIN can see sensitive fields
  if (callerRole !== 'ADMIN') {
    const { medicalConditions, objectives, deliveryAddress, passwordHash, ...safeUser } = user;
    return safeUser;
  }

  return user;
}

export async function updateRole(id, role) {
  return prisma.user.update({
    where: { id },
    data: { role },
  });
}

export async function deactivateUser(id) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
}