import { prisma } from "../config/index.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { emitAssistanceEvent } from "../realtime/ably.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { logger } from "../utils/logger.js";
import { sendTrainerAlert } from "./pushNotification.service.js";
import { registrarEvento } from "./historial.service.js";
import { AppError } from "../utils/errors.js";
import { logActivity, ACTIVITY } from "./activityLog.service.js";
import { signalStaff, TOPIC } from "../realtime/staffSignal.js";

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

  signalStaff(TOPIC.HELP);

  // Push alert to whichever trainers are free right now for THIS specific
  // request (non-blocking; a push failure must never break the request).
  notifyAvailableTrainers(assistance).catch((err) =>
    logger.error("[assistance] Failed to notify trainers:", err.message)
  );

  return assistance;
}

async function notifyAvailableTrainers(assistance) {
  const freeTrainers = await prisma.user.findMany({
    where: {
      role: "TRAINER",
      isActive: true,
      trainerProfile: { availability: "AVAILABLE", pendingAlertAssistanceId: null },
    },
    select: { id: true },
  });

  if (freeTrainers.length === 0) return;

  const requester = await prisma.user.findUnique({ where: { id: assistance.userId } });
  const userName = requester ? `${requester.firstName} ${requester.lastName}` : "Un socio";

  await sendTrainerAlert({
    trainerIds: freeTrainers.map((t) => t.id),
    type: "SOS_ENTRENADOR",
    payload: {
      assistanceId: assistance.id,
      userId: assistance.userId,
      userName,
      requestedAt: assistance.requestedAt.toISOString(),
    },
  });

  await prisma.trainerProfile.updateMany({
    where: { userId: { in: freeTrainers.map((t) => t.id) } },
    data: { pendingAlertAssistanceId: assistance.id, pendingAlertAt: new Date() },
  });
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

  // Where the member is right now (machine they are using), for the trainer's history.
  const usage = await prisma.machineUsage.findFirst({
    where: { userId: assistance.userId, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: { machineId: true },
  });

  const updated = await prisma.assistance.update({
    where: { id: assistanceId },
    data: { status: "ASSIGNED", trainerId, assignedAt: new Date(), machineId: usage?.machineId ?? null },
  });

  await setTrainerAvailability(trainerId, "BUSY");
  await releaseAlertLock(assistanceId);

  await logAssistanceStarted(trainerId, updated);
  signalStaff(TOPIC.HELP);

  return updated;
}

async function logAssistanceStarted(trainerId, assistance) {
  const member = await prisma.user.findUnique({
    where: { id: assistance.userId },
    select: { firstName: true, lastName: true, email: true },
  });
  const name = `${member?.firstName ?? ""} ${member?.lastName ?? ""}`.trim() || member?.email || null;
  await logActivity({
    actorId: trainerId,
    action: ACTIVITY.ASSISTANCE_STARTED,
    entityType: "Assistance",
    entityId: assistance.id,
    metadata: { member: name },
  });
}

/**
 * "Ir a ayudar": the trainer walks up to someone who is in the gym. If the
 * person pressed "Pedir ayuda" that request is assigned to the trainer;
 * otherwise a help the trainer starts on their own is created already assigned.
 */
export async function startAssistance(trainerId, userId) {
  const session = await prisma.gymSession.findFirst({ where: { userId, checkOutAt: null } });
  if (!session) throw new AppError("This person is not in the gym right now", 404);

  const open = await prisma.assistance.findFirst({
    where: { userId, status: { in: ["PENDING", "ASSIGNED"] } },
    orderBy: { requestedAt: "asc" },
  });

  if (open?.status === "ASSIGNED") {
    if (open.trainerId === trainerId) return open; // already on it
    throw new AppError("Another trainer is already helping this person", 409);
  }
  if (open?.status === "PENDING") {
    try {
      return await assignAssistance(open.id, trainerId);
    } catch (err) {
      throw new AppError(err.message, err.message.includes("busy") ? 409 : 400);
    }
  }

  const trainer = await prisma.user.findUnique({ where: { id: trainerId }, select: { isActive: true, role: true } });
  if (!trainer || trainer.role !== "TRAINER" || !trainer.isActive) throw new AppError("Only trainers can help members", 403);

  const usage = await prisma.machineUsage.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: { machineId: true },
  });

  const created = await prisma.assistance.create({
    data: { userId, trainerId, status: "ASSIGNED", assignedAt: new Date(), machineId: usage?.machineId ?? null },
  });
  await setTrainerAvailability(trainerId, "BUSY");
  await logAssistanceStarted(trainerId, created);
  signalStaff(TOPIC.HELP);
  return created;
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
    signalStaff(TOPIC.HELP);
    await setTrainerAvailability(updated.trainerId, "AVAILABLE");
    await logActivity({
      actorId: updated.trainerId,
      action: ACTIVITY.ASSISTANCE_COMPLETED,
      entityType: "Assistance",
      entityId: updated.id,
    });
  }

  // Both sides keep it in their personal history (trainer help for the student, student helped for the trainer).
  if (updated.trainerId) {
    const at = updated.completedAt ?? new Date();
    await Promise.all([
      registrarEvento({ userId: updated.userId, tipo: "TRAINER_ASSISTANCE", otherUserId: updated.trainerId, occurredAt: at, metadata: { assistanceId: updated.id, role: "STUDENT" } }),
      registrarEvento({ userId: updated.trainerId, tipo: "TRAINER_ASSISTANCE", otherUserId: updated.userId, occurredAt: at, metadata: { assistanceId: updated.id, role: "TRAINER" } }),
    ]);
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

// Current availability for a trainer; defaults to AVAILABLE when no
// TrainerProfile row exists yet (nobody has toggled it).
export async function getTrainerAvailability(trainerId) {
  const profile = await prisma.trainerProfile.findUnique({ where: { userId: trainerId } });
  return profile?.availability ?? "AVAILABLE";
}

// Lets the requester cancel their own PENDING/ASSIGNED assistance request.
// If a trainer had already been assigned, frees them back up to AVAILABLE.
export async function cancelAssistance(assistanceId, callerId) {
  const assistance = await prisma.assistance.findFirst({
    where: { id: assistanceId, userId: callerId },
  });

  if (!assistance) throw new Error("Assistance request not found");

  if (!["PENDING", "ASSIGNED"].includes(assistance.status)) {
    throw new Error(`Cannot cancel a request with status: ${assistance.status}`);
  }

  const updated = await prisma.assistance.update({
    where: { id: assistanceId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  if (assistance.status === "ASSIGNED" && assistance.trainerId) {
    await setTrainerAvailability(assistance.trainerId, "AVAILABLE");
    await releaseAlertLock(assistanceId);
  }
  signalStaff(TOPIC.HELP);

  return updated;
}
