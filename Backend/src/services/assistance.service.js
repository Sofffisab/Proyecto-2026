import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { emitAssistanceEvent } from "../realtime/ably.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { logger } from "../utils/logger.js";
import { sendTrainerAlert } from "./pushNotification.service.js";

export async function requestAssistance(userId) {
  // disableAssistance only blocks proactive outreach (see gym.service.js);
  // an explicit help request always goes through regardless of it
  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });

  const assistance = await prisma.assistance.create({
    data: { userId, status: "PENDING" },
  });

  // Realtime event for trainers with the app already open
  emitAssistanceEvent("ASSISTANCE_REQUESTED", {
    assistanceId: assistance.id,
    userId,
    requestedAt: assistance.requestedAt,
  });

  // Push alert to every available trainer (first to accept wins; non-blocking)
  notifyAvailableTrainers(assistance, requester).catch((err) =>
    logger.error("[assistance] Failed to push trainer alert:", err.message)
  );

  return assistance;
}

async function notifyAvailableTrainers(assistance, requester) {
  const availableTrainers = await prisma.user.findMany({
    where: {
      role: "TRAINER",
      isActive: true,
      OR: [
        { trainerProfile: null },
        { trainerProfile: { availability: "AVAILABLE" } },
      ],
    },
    select: { id: true },
  });

  if (availableTrainers.length === 0) return;

  await sendTrainerAlert({
    trainerIds: availableTrainers.map((t) => t.id),
    type: "SOS_ENTRENADOR",
    payload: {
      assistanceId: assistance.id,
      userId: assistance.userId,
      userName: requester ? `${requester.firstName} ${requester.lastName}` : "Un socio",
      requestedAt: assistance.requestedAt.toISOString(),
    },
  });
}

/** Permission check: only TRAINER accounts can be assigned assistance. */
export function canAssign(user) {
  return !!user && user.role === "TRAINER";
}

export async function assignAssistance(assistanceId, trainerId) {
  const trainer = await prisma.user.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      role: true,
      isActive: true,
      trainerProfile: { select: { availability: true } },
    },
  });

  if (!trainer) throw new Error("Trainer not found");
  if (!canAssign(trainer)) throw new Error("User is not a trainer");
  if (!trainer.isActive) throw new Error("Trainer account is disabled");

  // A trainer already busy (class or other assistance) can't be assigned again
  if (trainer.trainerProfile?.availability === "BUSY") {
    throw new Error("Trainer is currently busy and cannot be assigned new assistance");
  }

  const assistance = await prisma.assistance.findUnique({ where: { id: assistanceId } });
  if (!assistance) throw new Error("Assistance request not found");

  if (assistance.status !== "PENDING") {
    throw new Error(`Cannot assign a request with status: ${assistance.status}`);
  }

  const updated = await prisma.assistance.update({
    where: { id: assistanceId },
    data: { status: "ASSIGNED", trainerId, assignedAt: new Date() },
  });

  await setTrainerAvailability(trainerId, "BUSY");

  return updated;
}

/** Sets a trainer's availability; used both automatically and via manual trainer-facing toggle. */
export async function setTrainerAvailability(trainerId, availability) {
  if (!["AVAILABLE", "BUSY"].includes(availability)) {
    throw new Error("Invalid availability value");
  }

  return prisma.trainerProfile.upsert({
    where: { userId: trainerId },
    update: { availability, availabilityUpdatedAt: new Date() },
    create: {
      userId: trainerId,
      availability,
      specialties: ["GENERAL"],
    },
  });
}

export async function getTrainerAvailability(trainerId) {
  const profile = await prisma.trainerProfile.findUnique({ where: { userId: trainerId } });
  return profile?.availability ?? "AVAILABLE";
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
    await setTrainerAvailability(updated.trainerId, "AVAILABLE");
  }

  // Reward the student for the real, staff-facilitated engagement (non-blocking)
  addPoints(updated.userId, POINTS.ASSISTANCE_COMPLETED, "Trainer assistance completed").catch(
    (err) => logger.error("[assistance] Failed to award assistance points:", err.message)
  );

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

  const updated = await prisma.assistance.update({
    where: { id: assistanceId },
    data: { status: "CANCELLED" },
  });

  if (assistance.status === "ASSIGNED" && assistance.trainerId) {
    await setTrainerAvailability(assistance.trainerId, "AVAILABLE");
  }

  return updated;
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
