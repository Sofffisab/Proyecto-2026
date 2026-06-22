import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";

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
  return prisma.routine.findMany({ where: { userId } });
}

export async function getRoutineById(id, userId) {
  return prisma.routine.findFirst({ where: { id, userId } });
}

export async function updateRoutine(id, userId, data) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw new Error("Routine not found");
  if (routine.userId !== userId) throw new Error("Forbidden");

  const { name, content } = data;
  return prisma.routine.update({ where: { id }, data: { name, content } });
}

export async function deleteRoutine(id, userId) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw new Error("Routine not found");
  if (routine.userId !== userId) throw new Error("Forbidden");

  return prisma.routine.delete({ where: { id } });
}

/**
 * Returns the most recently created routine that belongs to the user.
 * Returns null if the user has no routines.
 *
 * Previous version fell back to routines of OTHER users (isCustom: false)
 * when the user had none — a privacy/data-leak bug that is now fixed.
 */
export async function getSuggestion(userId) {
  const latest = await prisma.routine.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return latest ?? null;
}

/**
 * @param {string} routineId
 * @param {string} userId
 * @param {number} dayIndex
 */
export async function completeDay(routineId, userId, dayIndex) {
  const routine = await prisma.routine.findFirst({ where: { id: routineId, userId } });
  if (!routine) throw new Error("Routine not found");

  const content = routine.content ?? {};
  const days = Array.isArray(content.days) ? content.days : [];

  if (dayIndex === undefined || dayIndex < 0 || dayIndex >= days.length) {
    throw new Error("Invalid dayIndex");
  }

  days[dayIndex] = { ...days[dayIndex], completed: true, completedAt: new Date().toISOString() };

  const updatedRoutine = await prisma.routine.update({
    where: { id: routineId },
    data: { content: { ...content, days } },
  });

  await addPoints(userId, POINTS.PROGRESS_UPDATE, `Routine day ${dayIndex + 1} completed`);

  return updatedRoutine;
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
    data: { userId, trainerId: trainerId || null, status: "PENDING" },
  });
}