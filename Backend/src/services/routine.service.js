import { prisma } from "../config/index.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { AppError } from "../utils/errors.js";
import { getUserBehaviorProfile } from "./behaviorAnalysis.service.js";
import { createNotification } from "./communication.service.js";

// A detected pattern needs at least this many occurrences before we're
// confident enough to actively propose it as a ready-made routine.
const MIN_OCCURRENCES_FOR_SUGGESTION = 3;

export async function createRoutine(userId, data) {
  const { name, content, isCustom } = data;
  return prisma.routine.create({
    data: {
      userId,
      name,
      content,
      isCustom: isCustom ?? true,
    },
  });
}

export async function getRoutines(userId) {
  return prisma.routine.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRoutineById(id, userId) {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw new AppError("Routine not found", 404);
  if (routine.userId !== userId) throw new AppError("Forbidden", 403);
  return routine;
}

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

  await addPoints(userId, POINTS.ROUTINE_DAY_COMPLETED, `Routine day ${dayIndex} completed`);

  return { success: true, message: `Day ${dayIndex} completed successfully` };
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

  // Only the assigned trainer (if any) may reject this request
  if (req.trainerId && req.trainerId !== callerId) {
    throw new AppError("Forbidden: Only the assigned trainer can reject this request", 403);
  }

  return prisma.routineRequest.update({
    where: { id: requestId },
    // Preserve trainerId as-is
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

/**
 * Builds a routine proposal from the user's learned training patterns
 * (see behaviorAnalysis.service.js). Returns { available: false, reason }
 * when there isn't enough history to suggest anything yet.
 */
export async function getPatternSuggestion(userId) {
  // Opted-out users don't get routines learned from machine-usage data
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { machineTrackingOptOut: true },
  });

  if (settings?.machineTrackingOptOut) {
    return {
      available: false,
      reason: "Machine tracking is disabled for this user by preference.",
    };
  }

  const profile = await getUserBehaviorProfile(userId);

  const topRoutine = (profile.routines ?? [])
    .filter((r) => r.occurrences >= MIN_OCCURRENCES_FOR_SUGGESTION)
    .sort((a, b) => b.occurrences - a.occurrences)[0];

  // Fall back to overall top machines if no repeating pattern is detected yet
  const machines = topRoutine?.signature ?? (profile.topMachines ?? []).map((m) => m.name);

  if (machines.length === 0) {
    return {
      available: false,
      reason: "Not enough workout history yet to suggest a routine.",
    };
  }

  const dayLabel = profile.frequentDays?.[0]?.name ?? null;
  const name = topRoutine
    ? `Suggested Routine${dayLabel ? ` for ${dayLabel}` : ""}`
    : "Suggested Routine (based on your most-used machines)";

  const content = {
    exercises: machines.map((machineName) => ({ machine: machineName })),
    basedOn: topRoutine
      ? { type: "RECURRING_PATTERN", occurrences: topRoutine.occurrences }
      : { type: "TOP_MACHINES" },
  };

  return {
    available: true,
    type: "AI_SUGGESTED_ROUTINE",
    name,
    content,
  };
}

/** Saves an AI-suggested routine to the user's list; recomputes it if the client didn't resend the payload. */
export async function acceptPatternSuggestion(userId, override = {}) {
  let { name, content } = override;

  if (!content) {
    const suggestion = await getPatternSuggestion(userId);
    if (!suggestion.available) {
      throw new AppError(suggestion.reason ?? "No suggestion available to accept", 400);
    }
    name = name ?? suggestion.name;
    content = suggestion.content;
  }

  const routine = await prisma.routine.create({
    data: {
      userId,
      name: name ?? "Suggested Routine",
      content,
      isCustom: false,
      source: "AI_SUGGESTED",
    },
  });

  return routine;
}

/** Records that the user declined the suggestion (nothing to delete, avoids re-nagging). */
export async function rejectPatternSuggestion(userId) {
  await createNotification(
    userId,
    "Suggestion dismissed",
    "You can keep using your saved routines or create a new one anytime."
  ).catch(() => {});

  return { rejected: true };
}

/** Home-screen options: saved routines, the always-available free routine, and a fresh AI suggestion if available. */
export async function getTodayOptions(userId) {
  const [routines, suggestion] = await Promise.all([
    getRoutines(userId),
    getPatternSuggestion(userId),
  ]);

  return {
    routines,
    freeRoutine: { id: "FREE_ROUTINE", name: "Rutina Libre", isFreeRoutine: true },
    suggestion: suggestion.available ? suggestion : null,
  };
}