import { prisma } from "../config/index.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { AppError } from "../utils/errors.js";
import { getUserBehaviorProfile } from "./behaviorAnalysis.service.js";
import { createNotification } from "./communication.service.js";
import { getScheduleDay, isValidDateKey, assertDateKey, estimateMinutes } from "./schedule.service.js";
import { getVisibleExercisesByIds } from "./exercise.service.js";
import { logActivity, ACTIVITY } from "./activityLog.service.js";
import { notifyLocalized } from "../locales/notifications.js";
import { randomUUID } from "crypto";
import { signalStaff, TOPIC } from "../realtime/staffSignal.js";

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

const nameOf = (u) => {
  if (!u) return null;
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || null;
};

// Never hand the whole User row to the app: it carries the password hash,
// reset tokens, medical data, address...
const PERSON_SAFE = { id: true, firstName: true, lastName: true, email: true };

export async function createRoutineRequest(userId, trainerId) {
  if (trainerId) {
    const trainer = await prisma.user.findUnique({ where: { id: trainerId } });
    if (!trainer || trainer.role !== "TRAINER") {
      throw new AppError("Invalid trainer selection", 400);
    }
  }

  // One open request at a time: asking again while a trainer is still on it
  // would only fill the trainers' list with duplicates.
  const open = await prisma.routineRequest.findFirst({
    where: { userId, status: { in: ["PENDING", "ACCEPTED", "PROPOSED"] } },
  });
  if (open) throw new AppError("You already have a routine request in progress", 409);

  const created = await prisma.routineRequest.create({
    data: { userId, trainerId, status: "PENDING" },
  });
  signalStaff(TOPIC.ROUTINES);
  return created;
}

function shapeRequestForTrainer(r) {
  return {
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    trainerId: r.trainerId,
    mine: Boolean(r.trainerId),
    proposedName: r.proposedName ?? null,
    proposedExercises: r.proposedExercises ?? null,
    member: {
      id: r.user.id,
      name: nameOf(r.user),
      // What the member filled in when they signed up: this is what the routine is built from.
      objectives: r.user.objectives ?? [],
      level: r.user.trainingLevel ?? null,
      weeklyTrainingDays: r.user.weeklyTrainingDays ?? null,
      trainingType: r.user.trainingType ?? null,
      medicalConditions: normalizeMedical(r.user.medicalConditions),
    },
  };
}

export function normalizeMedical(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  return Object.values(value).map((v) => String(v)).filter(Boolean);
}

export async function getRoutineRequests(userId, role) {
  if (role === "TRAINER" || role === "ADMIN") {
    // Open requests nobody took yet, plus everything this trainer is handling.
    const rows = await prisma.routineRequest.findMany({
      where: {
        OR: [
          { trainerId: userId, status: { in: ["ACCEPTED", "PROPOSED"] } },
          { trainerId: null, status: "PENDING" },
          { trainerId: userId, status: "PENDING" },
        ],
      },
      include: {
        user: {
          select: {
            ...PERSON_SAFE,
            objectives: true,
            trainingLevel: true,
            weeklyTrainingDays: true,
            trainingType: true,
            medicalConditions: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return (rows ?? []).map(shapeRequestForTrainer);
  }

  const rows = await prisma.routineRequest.findMany({
    where: { userId },
    include: { trainer: { select: PERSON_SAFE } },
    orderBy: { createdAt: "desc" },
  });
  return (rows ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    trainer: r.trainer ? { id: r.trainer.id, name: nameOf(r.trainer) } : null,
  }));
}

/** The trainer takes the request: from now on it is theirs. */
export async function acceptRoutineRequest(requestId, trainerId) {
  const req = await prisma.routineRequest.findUnique({ where: { id: requestId }, include: { user: { select: PERSON_SAFE } } });
  if (!req) throw new AppError("Routine request not found", 404);
  if (req.status !== "PENDING") throw new AppError("Request is not pending", 400);
  if (req.trainerId && req.trainerId !== trainerId) {
    throw new AppError("Forbidden: this request was addressed to another trainer", 403);
  }

  const updated = await prisma.routineRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED", trainerId },
  });

  await logActivity({
    actorId: trainerId,
    action: ACTIVITY.ROUTINE_REQUEST_ACCEPTED,
    entityType: "RoutineRequest",
    entityId: requestId,
    metadata: { member: nameOf(req.user) },
  });
  signalStaff(TOPIC.ROUTINES);
  return updated;
}

export async function rejectRoutineRequest(requestId, callerId) {
  const req = await prisma.routineRequest.findUnique({ where: { id: requestId }, include: { user: { select: PERSON_SAFE } } });
  if (!req) throw new AppError("Routine request not found", 404);
  if (req.status !== "PENDING") throw new AppError("Request is not pending", 400);

  // Only the assigned trainer (if any) may reject this request
  if (req.trainerId && req.trainerId !== callerId) {
    throw new AppError("Forbidden: Only the assigned trainer can reject this request", 403);
  }

  const updated = await prisma.routineRequest.update({
    where: { id: requestId },
    // Preserve trainerId as-is
    data: { status: "REJECTED" },
  });

  notifyLocalized(req.userId, "ROUTINE_REQUEST_REJECTED").catch(() => {});
  await logActivity({
    actorId: callerId,
    action: ACTIVITY.ROUTINE_REQUEST_REJECTED,
    entityType: "RoutineRequest",
    entityId: requestId,
    metadata: { member: nameOf(req.user) },
  });
  signalStaff(TOPIC.ROUTINES);
  return updated;
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

// ── The routine a trainer builds for a member ───────────────────────────

/** Built-in catalog exercises only: a trainer's private ones would not exist for the member. */
async function validateProposedExercises(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("Add at least one exercise", 400);
  }
  const ids = [...new Set(items.map((i) => i.exerciseId))];
  if (ids.length !== items.length) throw new AppError("An exercise is repeated", 400);

  const found = await prisma.exercise.findMany({
    where: { id: { in: ids }, active: true, isCustom: false },
    select: { id: true },
  });
  if ((found ?? []).length !== ids.length) throw new AppError("One of the exercises does not exist", 400);

  return items.map((i) => ({ exerciseId: i.exerciseId, sets: i.sets, reps: String(i.reps) }));
}

/** The trainer finished the routine: it goes to the member to preview and accept. */
export async function proposeRoutine(requestId, trainerId, { name, exercises }) {
  const req = await prisma.routineRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: PERSON_SAFE }, trainer: { select: PERSON_SAFE } },
  });
  if (!req) throw new AppError("Routine request not found", 404);
  if (req.trainerId !== trainerId) throw new AppError("Forbidden: this request is not assigned to you", 403);
  if (req.status !== "ACCEPTED") throw new AppError("Accept the request before building the routine", 400);

  const items = await validateProposedExercises(exercises);

  const updated = await prisma.routineRequest.update({
    where: { id: requestId },
    data: { status: "PROPOSED", proposedName: name, proposedExercises: items, proposedAt: new Date() },
  });

  notifyLocalized(req.userId, "ROUTINE_PROPOSAL", { trainer: nameOf(req.trainer) }).catch(() => {});

  await logActivity({
    actorId: trainerId,
    action: ACTIVITY.ROUTINE_PROPOSED,
    entityType: "RoutineRequest",
    entityId: requestId,
    metadata: { member: nameOf(req.user), routine: name, exercises: items.length },
  });
  signalStaff(TOPIC.ROUTINES);
  return updated;
}

/** Routines trainers prepared for this member that wait for their answer, with the exercises ready to preview. */
export async function getProposals(userId) {
  const rows = await prisma.routineRequest.findMany({
    where: { userId, status: "PROPOSED" },
    include: { trainer: { select: PERSON_SAFE } },
    orderBy: { proposedAt: "asc" },
  });
  if (!rows || rows.length === 0) return [];

  const ids = rows.flatMap((r) => (r.proposedExercises ?? []).map((i) => i.exerciseId));
  const exerciseMap = await getVisibleExercisesByIds(userId, ids);

  return rows.map((r) => {
    const exercises = (r.proposedExercises ?? [])
      .map((i) => (exerciseMap.get(i.exerciseId) ? { exerciseId: i.exerciseId, sets: i.sets, reps: i.reps, exercise: exerciseMap.get(i.exerciseId) } : null))
      .filter(Boolean);
    return {
      id: r.id,
      name: r.proposedName,
      proposedAt: r.proposedAt,
      trainer: r.trainer ? { id: r.trainer.id, name: nameOf(r.trainer) } : null,
      exercises,
      estimatedMinutes: estimateMinutes(exercises),
    };
  });
}

/**
 * The member answers. Accepting saves the routine in their account's default
 * routines (a routine only they see) and adds it to the routine of `date`
 * (their local "YYYY-MM-DD", today). If that day already has a routine the
 * trainer's exercises are added after it instead of replacing it.
 */
export async function respondToProposal(requestId, userId, { accept, date }) {
  const req = await prisma.routineRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { ...PERSON_SAFE, trainingLevel: true } }, trainer: { select: PERSON_SAFE } },
  });
  if (!req) throw new AppError("Routine request not found", 404);
  if (req.userId !== userId) throw new AppError("Forbidden", 403);
  if (req.status !== "PROPOSED") throw new AppError("There is no routine waiting for your answer", 400);

  const memberName = nameOf(req.user) ?? "–";

  if (!accept) {
    await prisma.routineRequest.update({ where: { id: requestId }, data: { status: "DECLINED", respondedAt: new Date() } });
    if (req.trainerId) {
      notifyLocalized(req.trainerId, "ROUTINE_ANSWERED", { member: memberName, accepted: false }).catch(() => {});
    }
    await logActivity({
      actorId: userId,
      action: ACTIVITY.ROUTINE_PROPOSAL_DECLINED,
      entityType: "RoutineRequest",
      entityId: requestId,
      metadata: { routine: req.proposedName, trainer: nameOf(req.trainer) },
    });
    signalStaff(TOPIC.ROUTINES);
    return { accepted: false };
  }

  assertDateKey(date);
  const items = Array.isArray(req.proposedExercises) ? req.proposedExercises : [];
  const exerciseMap = await getVisibleExercisesByIds(userId, items.map((i) => i.exerciseId));
  const usable = items.filter((i) => exerciseMap.has(i.exerciseId));
  if (usable.length === 0) throw new AppError("The exercises of this routine are no longer available", 409);

  const title = req.proposedName ?? "Rutina de tu entrenador";

  const result = await prisma.$transaction(async (tx) => {
    const routine = await tx.generalRoutine.create({
      data: {
        slug: `trainer-${randomUUID()}`,
        title,
        description: req.trainer ? `Armada por ${nameOf(req.trainer)}` : null,
        level: req.user.trainingLevel ?? null,
        position: 1000,
        ownerUserId: userId,
        createdByTrainerId: req.trainerId,
        exercises: {
          create: usable.map((i, index) => ({ exerciseId: i.exerciseId, position: index, sets: i.sets, reps: String(i.reps) })),
        },
      },
    });

    const existing = await tx.scheduleDay.findUnique({ where: { userId_date: { userId, date } } });
    if (existing) {
      const current = Array.isArray(existing.exercises) ? existing.exercises : [];
      const have = new Set(current.map((e) => e.exerciseId));
      await tx.scheduleDay.update({
        where: { id: existing.id },
        data: { exercises: [...current, ...usable.filter((i) => !have.has(i.exerciseId))] },
      });
    } else {
      await tx.scheduleDay.create({
        data: { userId, date, title, exercises: usable, source: "GENERAL", generalRoutineId: routine.id },
      });
    }

    await tx.routineRequest.update({
      where: { id: requestId },
      data: { status: "COMPLETED", respondedAt: new Date(), generalRoutineId: routine.id },
    });

    return routine;
  });

  if (req.trainerId) {
    notifyLocalized(req.trainerId, "ROUTINE_ANSWERED", { member: memberName, accepted: true }).catch(() => {});
  }
  await logActivity({
    actorId: userId,
    action: ACTIVITY.ROUTINE_PROPOSAL_ACCEPTED,
    entityType: "RoutineRequest",
    entityId: requestId,
    metadata: { routine: title, trainer: nameOf(req.trainer) },
  });

  signalStaff(TOPIC.ROUTINES);
  return { accepted: true, generalRoutineId: result.id, date };
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

/**
 * Home-screen options: today's day of the weekly schedule (when `dateKey`,
 * the member's local "YYYY-MM-DD", is given and a routine was saved for it),
 * saved routines, the always-available free routine, and a fresh AI suggestion.
 */
export async function getTodayOptions(userId, dateKey) {
  const [routines, suggestion, scheduled] = await Promise.all([
    getRoutines(userId),
    getPatternSuggestion(userId),
    dateKey && isValidDateKey(dateKey) ? getScheduleDay(userId, dateKey) : null,
  ]);

  // Shaped like a Routine row so the Home hero card needs no changes.
  const todayEntry = scheduled
    ? [
        {
          id: `schedule-${scheduled.date}`,
          name: scheduled.title,
          isCustom: scheduled.source === "MANUAL",
          source: scheduled.source,
          content: {
            exercises: scheduled.exercises.map(({ exerciseId, sets, reps }) => ({ exerciseId, sets, reps })),
            durationMinutes: scheduled.estimatedMinutes,
          },
        },
      ]
    : [];

  return {
    routines: [...todayEntry, ...routines],
    freeRoutine: { id: "FREE_ROUTINE", name: "Rutina Libre", isFreeRoutine: true },
    suggestion: suggestion.available ? suggestion : null,
  };
}
