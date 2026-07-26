import { prisma } from "../config/index.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { emitAssistanceEvent } from "../realtime/ably.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { logger } from "../utils/logger.js";
import { sendTrainerAlert } from "./pushNotification.service.js";

export async function requestAssistance(userId) {
  // disableAssistance only blocks proactive outreach (see gym.service.js);
  // an explicit help request always goes through regardless of it
  const assistance = await prisma.assistance.create({
    data: { userId, status: "PENDING" },
  });

  // Realtime event for trainers with the app already open
  emitAssistanceEvent("ASSISTANCE_REQUESTED", {
    assistanceId: assistance.id,
    userId,
    requestedAt: assistance.requestedAt,
  });

  // Try to dispatch this and any other waiting request to trainers that are
  // currently free to receive an alert (non-blocking).
  dispatchPendingAssistance().catch((err) =>
    logger.error("[assistance] Failed to dispatch pending assistance:", err.message)
  );

  return assistance;
}

// How long a pushed alert can sit unanswered before we free up the trainer
// so the next queued request (or a retry of this one) can reach them.
const ALERT_TIMEOUT_MINUTES = parseInt(process.env.ASSISTANCE_ALERT_TIMEOUT_MINUTES ?? "3", 10);

/**
 * Delivers exactly one alert at a time per trainer: a trainer holding an
 * unresolved alert (pendingAlertAssistanceId set) is skipped until it
 * resolves (accepted, cancelled, or timed out). Waiting requests are matched
 * to free trainers oldest-first (FIFO priority — "who came first").
 */
export async function dispatchPendingAssistance() {
  // Free up trainers whose alert has been sitting too long unanswered.
  const timeoutCutoff = new Date(Date.now() - ALERT_TIMEOUT_MINUTES * 60 * 1000);
  await prisma.trainerProfile.updateMany({
    where: { pendingAlertAssistanceId: { not: null }, pendingAlertAt: { lt: timeoutCutoff } },
    data: { pendingAlertAssistanceId: null, pendingAlertAt: null },
  });

  const pendingAssistances = await prisma.assistance.findMany({
    where: { status: "PENDING" },
    orderBy: { requestedAt: "asc" },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  if (pendingAssistances.length === 0) return;

  for (const assistance of pendingAssistances) {
    const freeTrainers = await prisma.user.findMany({
      where: {
        role: "TRAINER",
        isActive: true,
        trainerProfile: { availability: "AVAILABLE", pendingAlertAssistanceId: null },
      },
      select: { id: true },
    });

    if (freeTrainers.length === 0) break; // nobody free right now; rest stay queued

    await sendTrainerAlert({
      trainerIds: freeTrainers.map((t) => t.id),
      type: "SOS_ENTRENADOR",
      payload: {
        assistanceId: assistance.id,
        userId: assistance.userId,
        userName: assistance.user ? `${assistance.user.firstName} ${assistance.user.lastName}` : "Un socio",
        requestedAt: assistance.requestedAt.toISOString(),
      },
    });

    await prisma.trainerProfile.updateMany({
      where: { userId: { in: freeTrainers.map((t) => t.id) } },
      data: { pendingAlertAssistanceId: assistance.id, pendingAlertAt: new Date() },
    });
  }
}

/** Clears the alert lock for whichever trainers were holding it for this assistance, then re-dispatches so they can pick up the next queued request. */
async function releaseAlertLock(assistanceId) {
  await prisma.trainerProfile.updateMany({
    where: { pendingAlertAssistanceId: assistanceId },
    data: { pendingAlertAssistanceId: null, pendingAlertAt: null },
  });

  dispatchPendingAssistance().catch((err) =>
    logger.error("[assistance] Failed to re-dispatch after alert release:", err.message)
  );
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
  await releaseAlertLock(assistanceId);

  return updated;
}

/** Sets a trainer's availability; used both automatically and via manual trainer-facing toggle. */
export async function setTrainerAvailability(trainerId, availability) {
  if (!["AVAILABLE", "BUSY"].includes(availability)) {
    throw new Error("Invalid availability value");
  }

  const result = await prisma.trainerProfile.upsert({
    where: { userId: trainerId },
    update: { availability, availabilityUpdatedAt: new Date() },
    create: {
      userId: trainerId,
      availability,
      specialties: ["GENERAL"],
    },
  });

  if (availability === "AVAILABLE") {
    dispatchPendingAssistance().catch((err) =>
      logger.error("[assistance] Failed to dispatch after availability change:", err.message)
    );
  }

  return result;
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
