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

export async function updateRoutine(id, userId, data) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw new Error("Routine not found");
  if (routine.userId !== userId) throw new Error("Forbidden");

  return prisma.routine.update({
    where: { id },
    data,
  });
}

export async function deleteRoutine(id, userId) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw new Error("Routine not found");
  if (routine.userId !== userId) throw new Error("Forbidden");

  return prisma.routine.delete({
    where: { id },
  });
}

export async function getSuggestion(userId) {
  const latest = await prisma.routine.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (latest) return latest;

  // Return a default routine if the user has none
  return prisma.routine.findFirst({
    where: { isCustom: false },
    orderBy: { createdAt: "asc" },
  });
}

export async function createRoutineRequest(userId, trainerId) {
  if (trainerId) {
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
      select: { role: true, isActive: true },
    });
    if (!trainer || trainer.role !== "TRAINER") {
      throw new Error("Invalid trainer");
    }
    if (!trainer.isActive) {
      throw new Error("Trainer account is disabled");
    }
  }

  return prisma.routineRequest.create({
    data: {
      userId,
      trainerId: trainerId || null,
      status: "PENDING",
    },
  });
}