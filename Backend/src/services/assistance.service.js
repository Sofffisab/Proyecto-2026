import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";

export async function requestAssistance(userId) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  if (settings?.disableAssistance) {
    throw new Error("Assistance requests are disabled for this user");
  }

  return prisma.assistance.create({
    data: {
      userId,
      status: "PENDING",
    },
  });
}

export async function assignAssistance(assistanceId, trainerId) {
  const trainer = await prisma.user.findUnique({
    where: { id: trainerId },
    select: { id: true, role: true, isActive: true },
  });

  if (!trainer) throw new Error("Trainer not found");
  if (trainer.role !== "TRAINER") throw new Error("User is not a trainer");
  if (!trainer.isActive) throw new Error("Trainer account is disabled");

  const assistance = await prisma.assistance.findUnique({
    where: { id: assistanceId },
  });

  if (!assistance) throw new Error("Assistance request not found");
  if (assistance.status !== "PENDING") {
    throw new Error(`Cannot assign a request with status: ${assistance.status}`);
  }

  return prisma.assistance.update({
    where: { id: assistanceId },
    data: {
      trainerId,
      status: "ASSIGNED",
      assignedAt: new Date(),
    },
  });
}

export async function completeAssistance(assistanceId) {
  const assistance = await prisma.assistance.update({
    where: { id: assistanceId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  if (assistance.trainerId) {
    await updateTrainerMetrics(assistance.trainerId);
  }

  return assistance;
}

export async function getPendingAssistance() {
  return prisma.assistance.findMany({
    where: { status: "PENDING" },
    include: { user: true },
  });
}

export async function getAssistanceHistory(userId) {
  return prisma.assistance.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    include: { trainer: true },
  });
}