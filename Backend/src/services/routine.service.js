import prisma from "../config/prisma.js";

export async function createRoutine(userId, data) {
  return prisma.routine.create({
    data: {
      userId,
      name: data.name || null,
      isCustom: data.isCustom || false,
      content: data.content,
    },
  });
}

export async function getRoutines(userId) {
  return prisma.routine.findMany({
    where: { userId },
  });
}

export async function updateRoutine(id, data) {
  return prisma.routine.update({
    where: { id },
    data,
  });
}

export async function deleteRoutine(id) {
  return prisma.routine.delete({
    where: { id },
  });
}