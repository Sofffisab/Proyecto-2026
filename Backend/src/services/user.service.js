import prisma from "../config/prisma.js";

export async function getUsers() {
  return prisma.user.findMany({
    include: {
      trainerProfile: true,
    },
  });
}

export async function getUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      trainerProfile: true,
      settings: true,
    },
  });
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