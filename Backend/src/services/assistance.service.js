import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { emitAssistanceEvent } from "../realtime/ably.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { logger } from "../utils/logger.js";

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

/**
 * Pure permission check: only TRAINER accounts can be assigned an
 * assistance request. Extracted so callers (routes, other services, tests)
 * can check eligibility without going through the full assignAssistance
 * side-effecting flow.
 */
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

  // A trainer already dictating a class / helping another student must not
  // be handed a second alert — the profile's availability flag is the source
  // of truth for that. A trainer with no profile yet is treated as available.
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

/**
 * Sets a trainer's availability flag. Used automatically around assignment /
 * completion / cancellation, and also usable by a trainer-facing endpoint so
 * a trainer can manually mark themselves BUSY (e.g. dictating a class) even
 * without an active Assistance record.
 */
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

  // Reward the student for the interaction actually happening — a real,
  // staff-facilitated engagement is exactly the kind of behavior the gym
  // wants to encourage (as opposed to just showing up and never asking
  // for help). Non-blocking: never let a points failure break the
  // assistance completion itself.
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
