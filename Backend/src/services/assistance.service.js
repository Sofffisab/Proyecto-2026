import prisma from "../config/prisma.js";

export async function requestAssistance(userId) {
  return prisma.assistance.create({
    data: {
      userId,
      status: "PENDING",
    },
  });
}

export async function assignAssistance(assistanceId, trainerId) {
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
  return prisma.assistance.update({
    where: { id: assistanceId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

export async function getPendingAssistance() {
  return prisma.assistance.findMany({
    where: {
      status: "PENDING",
    },
    include: {
      user: true,
    },
  });
}

export async function getAssistanceHistory(userId) {
  return prisma.assistance.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    include: {
      trainer: true,
    },
  });
}