import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { emitAssistanceEvent } from "../realtime/ably.js";

export async function requestAssistance(userId) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });

  if (settings?.disableAssistance) {
    throw new Error("Assistance requests are disabled for this user");
  }

  const assistance = await prisma.assistance.create({
    data: { userId, status: "PENDING" },
  });

  emitAssistanceEvent("ASSISTANCE_REQUESTED", {
    assistanceId: assistance.id,
    userId,
    requestedAt: assistance.requestedAt,
  });

  return assistance;
}

export async function assignAssistance(assistanceId, trainerId) {
  const trainer = await prisma.user.findUnique({
    where: { id: trainerId },
    select: { id: true, role: true, isActive: true },
  });

  if (!trainer) throw new Error("Trainer not found");
  if (trainer.role !== "TRAINER") throw new Error("User is not a trainer");
  if (!trainer.isActive) throw new Error("Trainer account is disabled");

  const assistance = await prisma.assistance.findUnique({ where: { id: assistanceId } });
  if (!assistance) throw new Error("Assistance request not found");

  if (assistance.status !== "PENDING") {
    throw new Error(`Cannot assign a request with status: ${assistance.status}`);
  }

  return prisma.assistance.update({
    where: { id: assistanceId },
    data: { status: "ASSIGNED", trainerId, assignedAt: new Date() },
  });
}

export async function completeAssistance(assistanceId, callerId, callerRole) {
  const assistance = await prisma.assistance.findUnique({ where: { id: assistanceId } });
  if (!assistance) throw new Error("Assistance request not found");

  if (assistance.status !== "ASSIGNED") {
    throw new Error(`Cannot complete a request with status: ${assistance.status}`);
  }

  if (callerRole === "TRAINER" && assistance.trainerId !== callerId) {
    throw new Error("Forbidden: this assistance is not assigned to you");
  }

  const updated = await prisma.assistance.update({
    where: { id: assistanceId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  if (updated.trainerId) {
    await updateTrainerMetrics(updated.trainerId);
  }

  return updated;
}

export async function cancelAssistance(assistanceId, userId) {
  const assistance = await prisma.assistance.findFirst({
    where: { id: assistanceId, userId },
  });

  if (!assistance) {
    throw new Error("Assistance request not found");
  }

  if (!["PENDING", "ASSIGNED"].includes(assistance.status)) {
    throw new Error(`Cannot cancel a request with status: ${assistance.status}`);
  }

  return prisma.assistance.update({
    where: { id: assistanceId },
    data: { status: "CANCELLED" },
  });
}

export async function getPendingAssistance() {
  return prisma.assistance.findMany({
    where: { status: "PENDING" },
    orderBy: { requestedAt: "asc" },
  });
}

export async function getAssistanceHistory(userId) {
  return prisma.assistance.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
  });
}
