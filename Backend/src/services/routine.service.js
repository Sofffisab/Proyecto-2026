import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { AppError } from "../utils/errors.js";

export async function updateRoutine(id, userId, data) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw new AppError("Routine not found", 404);
  if (routine.userId !== userId) throw new AppError("Forbidden", 403);

  const { name, content } = data;
  return prisma.routine.update({ where: { id }, data: { name, content } });
}

export async function deleteRoutine(id, userId) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw new AppError("Routine not found", 404);
  if (routine.userId !== userId) throw new AppError("Forbidden", 403);

  return prisma.routine.delete({ where: { id } });
}

export async function completeDay(routineId, dayIndex, userId) {
  const routine = await prisma.routine.findUnique({ where: { id: routineId } });
  if (!routine) throw new AppError("Routine not found", 404);
  if (routine.userId !== userId) throw new AppError("Forbidden", 403);

  await addPoints(userId, POINTS.ROUTINE_DAY_COMPLETED);

  return { success: true, message: `Day ${dayIndex} completed successfully` };
}

export async function getSuggestion(userId) {
  const userProfile = await prisma.user.findUnique({
    where: { id: userId },
    include: { goals: true },
  });
  if (!userProfile) throw new AppError("User not found", 404);
  return { type: "AUTOMATED_SUGGESTION", target: userProfile.goals?.[0]?.type || "GENERAL" };
}

export async function createRoutineRequest(userId, trainerId) {
  if (trainerId) {
    const trainer = await prisma.user.findUnique({ where: { id: trainerId } });
    if (!trainer || trainer.role !== "TRAINER") {
      throw new AppError("Invalid trainer selection", 400);
    }
  }

  return prisma.routineRequest.create({
    data: { userId, trainerId, status: "PENDING" },
  });
}

export async function getRoutineRequests(userId, role) {
  if (role === "TRAINER" || role === "ADMIN") {
    return prisma.routineRequest.findMany({
      where: { OR: [{ trainerId: userId }, { trainerId: null }] },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
  }
  return prisma.routineRequest.findMany({
    where: { userId },
    include: { trainer: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptRoutineRequest(requestId, trainerId) {
  const req = await prisma.routineRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError("Routine request not found", 404);
  if (req.status !== "PENDING") throw new AppError("Request is not pending", 400);

  return prisma.routineRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED", trainerId },
  });
}

export async function rejectRoutineRequest(requestId, callerId) {
  const req = await prisma.routineRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError("Routine request not found", 404);
  if (req.status !== "PENDING") throw new AppError("Request is not pending", 400);

  // Fix #17: if the request is already assigned to a specific trainer, only that
  // trainer may reject it — prevents any other trainer from hijacking the rejection.
  if (req.trainerId && req.trainerId !== callerId) {
    throw new AppError("Forbidden: Only the assigned trainer can reject this request", 403);
  }

  return prisma.routineRequest.update({
    where: { id: requestId },
    // Do NOT overwrite trainerId — preserve whoever was assigned (or null).
    data: { status: "REJECTED" },
  });
}

export async function completeRoutineRequest(requestId, callerId) {
  const req = await prisma.routineRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError("Routine request not found", 404);
  if (req.status !== "ACCEPTED") throw new AppError("Request must be accepted before completion", 400);
  if (req.trainerId !== callerId) throw new AppError("Forbidden: Only the assigned trainer can complete this", 403);

  return prisma.routineRequest.update({
    where: { id: requestId },
    data: { status: "COMPLETED" },
  });
}