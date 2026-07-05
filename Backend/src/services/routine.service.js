import prisma from "../config/prisma.js";
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

export async function getSuggestion(userId) {
  const userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!userExists) throw new AppError("User not found", 404);

  // Real suggestion logic: pick the active goal that most needs attention —
  // i.e. never logged / stalest progress entry first, then lowest completion %.
  // This mirrors the "which goal is overdue/underperforming" analysis already
  // used by suggestionEngine.service.js's evaluateUserProgress.
  const goals = await prisma.goal.findMany({
    where: { userId, active: true },
    include: {
      progress: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (goals.length === 0) {
    return { type: "AUTOMATED_SUGGESTION", target: "GENERAL", reason: "No active goals set" };
  }

  const now = new Date();
  const scored = goals.map((goal) => {
    const lastEntry = goal.progress[0];
    const daysSinceUpdate = lastEntry
      ? Math.floor((now - new Date(lastEntry.createdAt)) / (1000 * 60 * 60 * 24))
      : Infinity; // never updated = most urgent
    const progressPercent = lastEntry ? lastEntry.progressPercent : 0;
    return { goal, daysSinceUpdate, progressPercent };
  });

  // Sort by most stale first, then by lowest progress percent.
  scored.sort((a, b) => {
    if (b.daysSinceUpdate !== a.daysSinceUpdate) return b.daysSinceUpdate - a.daysSinceUpdate;
    return a.progressPercent - b.progressPercent;
  });

  const top = scored[0];
  return {
    type: "AUTOMATED_SUGGESTION",
    target: top.goal.type,
    goalId: top.goal.id,
    reason:
      top.daysSinceUpdate === Infinity
        ? "This goal has no progress logged yet"
        : `Last updated ${top.daysSinceUpdate} day(s) ago at ${top.progressPercent.toFixed(0)}% progress`,
  };
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

/**
 * Builds a ready-to-accept routine proposal from the user's learned training
 * patterns (see behaviorAnalysis.service.js). This is the "AI" behind the
 * suggested-routines feature: it looks at the machine-signature the user
 * already repeats most often and turns it into routine content, instead of
 * asking the user to build one from scratch.
 *
 * Returns `{ available: false, reason }` when there isn't enough history yet
 * to responsibly suggest anything.
 */
export async function getPatternSuggestion(userId) {
  const profile = await getUserBehaviorProfile(userId);

  const topRoutine = (profile.routines ?? [])
    .filter((r) => r.occurrences >= MIN_OCCURRENCES_FOR_SUGGESTION)
    .sort((a, b) => b.occurrences - a.occurrences)[0];

  // Fall back to the user's overall top machines if no repeating signature
  // has been detected yet, as long as there's at least some history —
  // better than offering nothing, but clearly marked as a lighter-weight guess.
  const machines = topRoutine?.signature ?? (profile.topMachines ?? []).map((m) => m.name);

  if (machines.length === 0) {
    return {
      available: false,
      reason: "Todavía no hay suficiente historial de entrenamiento para sugerir una rutina.",
    };
  }

  const dayLabel = profile.frequentDays?.[0]?.name ?? null;
  const name = topRoutine
    ? `Rutina sugerida${dayLabel ? ` de ${dayLabel}` : ""}`
    : "Rutina sugerida (según tus máquinas más usadas)";

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

/**
 * Saves an AI-suggested routine into the user's own routine list (so it
 * shows up next to their other saved routines / "Rutina Libre" on the home
 * screen). If the client doesn't re-send the exact suggestion payload, we
 * recompute it fresh rather than trusting an unrelated body.
 */
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
      name: name ?? "Rutina sugerida",
      content,
      isCustom: false,
      source: "AI_SUGGESTED",
    },
  });

  return routine;
}

/**
 * Records that the user declined the suggested routine. This doesn't delete
 * anything (nothing was saved yet) — it just lets the app avoid nagging the
 * same user with the same suggestion again right away.
 */
export async function rejectPatternSuggestion(userId) {
  await createNotification(
    userId,
    "Sugerencia descartada",
    "Podés seguir usando tus rutinas guardadas o crear una nueva cuando quieras."
  ).catch(() => {});

  return { rejected: true };
}

/**
 * What the home screen shows the user to pick "which routine today":
 * every routine they've saved (manual or previously-accepted AI ones), the
 * always-available "Rutina Libre" (free-form, no fixed plan) option, and —
 * if their pattern history supports it — a fresh AI suggestion they can
 * accept or reject on the spot.
 */
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