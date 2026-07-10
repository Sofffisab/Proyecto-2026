import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { addPoints, checkAndUnlockAchievements } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { emitUserNeedsAttention } from "../realtime/ably.js";
import { notifyTrainerOfReturningStudent } from "./communication.service.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { createAutoNoHelpComplaint } from "./complaint.service.js";

// Emit USER_NEEDS_ATTENTION when a user has been waiting this many minutes without assistance
const ATTENTION_THRESHOLD_MINUTES = parseInt(process.env.ATTENTION_THRESHOLD_MINUTES ?? "30", 10);

// Alert a trainer on check-in if it's been at least this many days since they
// last assisted this specific student (or they've never assisted them at all).
const ABANDONMENT_ALERT_THRESHOLD_DAYS = parseInt(process.env.ABANDONMENT_ALERT_THRESHOLD_DAYS ?? "14", 10);

// getPriorityAssistanceList ordering granularity: students are grouped into
// "wait-time buckets" of this many minutes before the other three criteria
// (specialty, preference, seniority) get a say — see the function's doc
// comment for the full rationale and worked example.
const PRIORITY_LIST_WAIT_BUCKET_MINUTES = parseInt(
  process.env.PRIORITY_LIST_WAIT_BUCKET_MINUTES ?? "15",
  10
);

export async function checkIn(userId, options = {}) {
  // `checkInAt` lets callers (e.g. offline sync) record the real moment the
  // check-in happened, while the trainer alert below always uses "now"
  // (unless explicitly disabled) — see the comment further down.
  const { checkInAt: requestedCheckInAt, alertNow = true } = options;

  // Real-world tolerance: if the user already has an open session (e.g. they
  // scanned the entry QR twice by accident), don't block them — just return
  // the existing session instead of treating it as an error. The first scan
  // is what counts as the real entry.
  const existing = await prisma.gymSession.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  const checkInAt = requestedCheckInAt ?? new Date();

  const session = await prisma.gymSession.create({
    data: {
      userId,
      checkInAt,
    },
  });

  // Award check-in points (non-blocking)
  addPoints(userId, POINTS.CHECK_IN, "Gym check-in").catch((err) =>
    logger.error("[gym] Failed to award check-in points:", err.message)
  );

  // A new check-in can push a consistency streak (days/weeks/months) past a
  // badge threshold — evaluate personal achievements (non-blocking).
  Promise.resolve(checkAndUnlockAchievements(userId)).catch((err) =>
    logger.error("[gym] Failed to check achievements on check-in:", err.message)
  );

  // Alert trainer(s) who haven't helped this student in a long time that
  // they just walked in (non-blocking — never delay the check-in response).
  // The alert always uses "now" (unless explicitly disabled) since the whole
  // point is real-time attention: even a check-in synced late from offline
  // storage means the student may currently be on the floor right now.
  if (alertNow) {
    notifyAbandoningTrainersOnCheckIn(userId, new Date()).catch((err) =>
      logger.error("[gym] Failed to notify trainer(s) of returning student:", err.message)
    );
  }

  return session;
}

/**
 * Resolves a human-readable description of where a student currently is in
 * the gym, for trainer-facing real-time alerts. Prefers the machine/zone of
 * their most recent still-active MachineUsage; falls back to a generic
 * "just checked in" location if they haven't started using a machine yet.
 */
export async function getUserCurrentLocation(userId) {
  // "No usar la app para máquinas": these users are never tracked at
  // machine/zone granularity — trainers still see them on the help list,
  // just without any machine info, only that they're present in the gym.
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { machineTrackingOptOut: true },
  });

  if (!settings?.machineTrackingOptOut) {
    const activeUsage = await prisma.machineUsage.findFirst({
      where: { userId, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: { machine: true },
    });

    if (activeUsage?.machine) {
      return activeUsage.machine.zone
        ? `${activeUsage.machine.zone} (${activeUsage.machine.name})`
        : activeUsage.machine.name;
    }
  }

  const activeSession = await prisma.gymSession.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  if (!activeSession) return "ubicación desconocida";

  return settings?.machineTrackingOptOut
    ? "en el gimnasio (máquina no rastreada por preferencia del usuario)"
    : "entrada del gimnasio (recién ingresó)";
}

/**
 * Finds trainers who are "overdue" on helping this student — the student's
 * preferred trainer, plus any trainer who has assisted them before — and
 * sends each of them an in-app notification when the gap since their last
 * completed assistance with this specific student is at least
 * ABANDONMENT_ALERT_THRESHOLD_DAYS (or they've never assisted them at all,
 * despite being the preferred trainer).
 */
async function notifyAbandoningTrainersOnCheckIn(userId, checkInAt) {
  const student = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      settings: { select: { trainerPreference: true, disableAssistance: true } },
    },
  });

  if (!student || student.settings?.disableAssistance) return;

  const candidateTrainerIds = new Set();
  if (student.settings?.trainerPreference) {
    candidateTrainerIds.add(student.settings.trainerPreference);
  }

  const pastTrainers = await prisma.assistance.findMany({
    where: { userId, status: "COMPLETED", trainerId: { not: null } },
    select: { trainerId: true },
    distinct: ["trainerId"],
  });
  pastTrainers.forEach((a) => candidateTrainerIds.add(a.trainerId));

  if (candidateTrainerIds.size === 0) return;

  const now = checkInAt.getTime();

  for (const trainerId of candidateTrainerIds) {
    const lastAssistance = await prisma.assistance.findFirst({
      where: { userId, trainerId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });

    let daysSinceLastAssistance = null;
    if (lastAssistance?.completedAt) {
      daysSinceLastAssistance = Math.floor((now - new Date(lastAssistance.completedAt).getTime()) / 86400000);
    }

    const shouldAlert = daysSinceLastAssistance == null || daysSinceLastAssistance >= ABANDONMENT_ALERT_THRESHOLD_DAYS;
    if (!shouldAlert) continue;

    // Resolved fresh per trainer/alert since a little time may pass between
    // check-in and this loop running; the trainer needs where the student
    // IS right now, not where they were when the loop started.
    const location = await getUserCurrentLocation(userId);

    await notifyTrainerOfReturningStudent(trainerId, student, {
      checkInAt,
      daysSinceLastAssistance,
      location,
    });
  }
}

export async function checkOut(userId) {
  // If there's no open session, this is a genuine client error (nothing to
  // check out of) — reject it with 400 rather than silently succeeding.
  //
  // Also treat an auto-closed session (closed by the expiration cron job
  // because the user forgot to scan out) as still "current": if the user
  // scans out for real afterwards, that's the exit that counts, not the
  // automatic one.
  const session = await prisma.gymSession.findFirst({
    where: {
      userId,
      OR: [{ checkOutAt: null }, { autoClosed: true }],
    },
    orderBy: { checkInAt: "desc" },
  });

  if (!session) {
    throw new AppError("No active check-in session", 400);
  }

  const checkOutAt = new Date();
  const durationMinutes = Math.round((checkOutAt - session.checkInAt) / 60000);

  const updated = await prisma.gymSession.update({
    where: { id: session.id },
    data: { checkOutAt, durationMinutes, autoClosed: false },
  });

  // "Se cierra sola la sesión de una máquina ... al irse": leaving the gym
  // implies whatever machine the user was on is done too. Dynamic import to
  // avoid a require-cycle (verification.service.js imports checkIn/checkOut
  // from this module).
  try {
    const { closeOpenMachineUsage } = await import("./verification.service.js");
    await closeOpenMachineUsage(userId, "Machine usage auto-closed (left the gym)");
  } catch (err) {
    logger.error("[gym] Failed to auto-close machine usage on check-out:", err.message);
  }

  // Award check-out points (non-blocking)
  addPoints(userId, POINTS.CHECK_OUT, "Gym check-out").catch((err) =>
    logger.error("[gym] Failed to award check-out points:", err.message)
  );

  Promise.resolve(checkAndUnlockAchievements(userId)).catch((err) =>
    logger.error("[gym] Failed to check achievements on check-out:", err.message)
  );

  return updated;
}

/**
 * Cancels a pending auto-checkout: called whenever the user does something
 * that proves they're still physically in the gym (e.g. scanning a machine),
 * so an in-progress session isn't wrongly expired.
 */
export async function reopenSessionIfAutoClosed(userId) {
  const session = await prisma.gymSession.findFirst({
    where: { userId, autoClosed: true },
    orderBy: { checkInAt: "desc" },
  });

  if (!session) return null;

  return prisma.gymSession.update({
    where: { id: session.id },
    data: { checkOutAt: null, durationMinutes: null, autoClosed: false },
  });
}

export async function getCurrentSession(userId) {
  return prisma.gymSession.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });
}

export async function getSessionHistory(userId) {
  return prisma.gymSession.findMany({
    where: { userId },
    orderBy: { checkInAt: "desc" },
  });
}

export async function getSessionById(sessionId, userId) {
  return prisma.gymSession.findFirst({
    where: { id: sessionId, userId },
  });
}

export async function getPresentUsers() {
  // Fetch all users currently checked in, including their last assistance
  // in a single query to avoid N+1.
  const activeSessions = await prisma.gymSession.findMany({
    where: { checkOutAt: null },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          medicalConditions: true,
          trainingLevel: true,
          objectives: true,
          settings: { select: { trainerPreference: true, disableAssistance: true, disableSocial: true } },
        },
      },
    },
  });

  if (activeSessions.length === 0) return [];

  const userIds = activeSessions.map((s) => s.userId);

  // One query: latest completed assistance per user
  const lastAssistances = await prisma.assistance.findMany({
    where: { userId: { in: userIds }, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { userId: true, completedAt: true },
    distinct: ["userId"],
  });

  const lastAssistanceMap = lastAssistances.reduce((acc, a) => {
    acc[a.userId] = a.completedAt;
    return acc;
  }, {});

  const enriched = activeSessions.map((session) => ({
    ...session,
    lastAssistanceAt: lastAssistanceMap[session.userId] ?? null,
  }));

  // Emit USER_NEEDS_ATTENTION for users who have been waiting too long.
  // This is proactive trainer outreach, so users who opted out via
  // `disableAssistance` are skipped — they can still ask for help anytime
  // via the explicit assistance button (see assistance.service.js#requestAssistance),
  // we just don't nudge trainers to go find them unprompted.
  const now = Date.now();
  for (const session of enriched) {
    if (session.user.settings?.disableAssistance) continue;

    const lastAt = session.lastAssistanceAt
      ? new Date(session.lastAssistanceAt).getTime()
      : new Date(session.checkInAt).getTime();
    const minutesWaiting = Math.floor((now - lastAt) / 60000);
    if (minutesWaiting >= ATTENTION_THRESHOLD_MINUTES) {
      emitUserNeedsAttention(session.userId, session.lastAssistanceAt, minutesWaiting);
    }
  }

  // Sort: longest since last assistance first (most urgent)
  enriched.sort((a, b) => {
    const aTime = a.lastAssistanceAt ? new Date(a.lastAssistanceAt).getTime() : 0;
    const bTime = b.lastAssistanceAt ? new Date(b.lastAssistanceAt).getTime() : 0;

    if (aTime !== bTime) return aTime - bTime;

    const aPref = a.user.settings?.trainerPreference ? 0 : 1;
    const bPref = b.user.settings?.trainerPreference ? 0 : 1;
    if (aPref !== bPref) return aPref - bPref;

    return new Date(a.user.createdAt).getTime() - new Date(b.user.createdAt).getTime();
  });

  return enriched;
}

/**
 * Priority list of present students for a specific trainer's attention screen.
 *
 * Ordering is a strict, four-level sort — each criterion only breaks ties
 * left by the one before it — but "criterion 1" is bucketed rather than an
 * exact timestamp, otherwise it would decide the order almost by itself
 * (two students are essentially never helped at the exact same millisecond,
 * so criteria 2-4 would never get a real chance to matter). Concretely:
 *
 *   1) WAIT BUCKET: minutes since last help (Infinity/"never helped" sorts
 *      first), rounded DOWN to PRIORITY_LIST_WAIT_BUCKET_MINUTES (15 by
 *      default — half of ATTENTION_THRESHOLD_MINUTES, i.e. two "waited too
 *      long" alerts fit in one bucket). Students within the same 15-minute
 *      band count as equally overdue, and fall through to:
 *   2) SPECIALTY MATCH: trainer's specialty covers the student's goal.
 *   3) TRAINER PREFERENCE: student explicitly prefers this trainer.
 *   4) SENIORITY: older member account first.
 *   5) Exact wait time (oldest first) as a final deterministic tiebreaker
 *      once all of the above are equal, so the order is always stable.
 *
 * Worked example: two students both went unhelped for 20-27 minutes (same
 * 15-29 min bucket). Student A doesn't match the trainer's specialty;
 * student B does. B is shown first, even though A has waited slightly
 * longer — a 27-minute wait isn't meaningfully more urgent than 20 minutes,
 * but a genuine specialty match is worth prioritizing within that band. If
 * A had instead waited 31 minutes (next bucket up), A would come first
 * regardless of specialty — real wait-time gaps still win across buckets.
 *
 * Users with `disableAssistance` set are excluded entirely.
 */
export async function getPriorityAssistanceList(trainerId) {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerId },
  });
  const specialties = trainerProfile?.specialties ?? [];

  const activeSessions = await prisma.gymSession.findMany({
    where: { checkOutAt: null },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          medicalConditions: true,
          trainingLevel: true,
          objectives: true,
          settings: { select: { trainerPreference: true, disableAssistance: true } },
        },
      },
    },
  });

  const students = activeSessions.filter(
    (s) => s.user.role === "USER" && !s.user.settings?.disableAssistance
  );

  if (students.length === 0) return [];

  const userIds = students.map((s) => s.userId);

  const lastAssistances = await prisma.assistance.findMany({
    where: { userId: { in: userIds }, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { userId: true, completedAt: true },
    distinct: ["userId"],
  });

  const lastAssistanceMap = lastAssistances.reduce((acc, a) => {
    acc[a.userId] = a.completedAt;
    return acc;
  }, {});

  // A student's objectives are matched against the trainer's specialties.
  // objectives is now MainGoal[] (fixed enum, from pantalla U) — still a
  // plain array of strings at the JS level, so this keeps working unchanged.
  // The `o?.type ?? o?.goal` branch is dead weight from when this was a
  // free-form JSON field; kept only so any still-unmigrated legacy rows
  // (pre-migration snapshots) don't crash.
  function studentGoalTypes(objectives) {
    if (!Array.isArray(objectives)) return [];
    return objectives.map((o) => (typeof o === "string" ? o : o?.type ?? o?.goal)).filter(Boolean);
  }

  const enriched = students.map((session) => {
    const lastAssistanceAt = lastAssistanceMap[session.userId] ?? null;
    const goals = studentGoalTypes(session.user.objectives);
    const specialtyMatch = specialties.some((sp) => goals.includes(sp));
    const prefersThisTrainer = session.user.settings?.trainerPreference === trainerId;

    return {
      ...session,
      lastAssistanceAt,
      specialtyMatch,
      prefersThisTrainer,
    };
  });

  const bucketMs = PRIORITY_LIST_WAIT_BUCKET_MINUTES * 60 * 1000;
  const now = Date.now();

  // Never-helped users get the largest possible wait (bucket 0 is the
  // soonest-helped; a huge bucket number here puts them first once we sort
  // buckets ascending) — mirrors the previous "epoch 0 sorts first" trick,
  // just expressed as a bucket count instead of a raw timestamp.
  function waitBucket(lastAssistanceAt) {
    if (!lastAssistanceAt) return Number.POSITIVE_INFINITY;
    const waitedMs = now - new Date(lastAssistanceAt).getTime();
    return Math.floor(waitedMs / bucketMs);
  }

  enriched.forEach((s) => {
    s.waitBucket = waitBucket(s.lastAssistanceAt);
  });

  enriched.sort((a, b) => {
    // 1) Wait-time bucket — larger bucket (longer overdue) sorts first.
    if (a.waitBucket !== b.waitBucket) return b.waitBucket - a.waitBucket;

    // 2) Trainer specialty matches the student's goal
    if (a.specialtyMatch !== b.specialtyMatch) return a.specialtyMatch ? -1 : 1;

    // 3) Student's explicit preference for this trainer
    if (a.prefersThisTrainer !== b.prefersThisTrainer) return a.prefersThisTrainer ? -1 : 1;

    // 4) Seniority as a member (older account first)
    const seniorityDiff = new Date(a.user.createdAt).getTime() - new Date(b.user.createdAt).getTime();
    if (seniorityDiff !== 0) return seniorityDiff;

    // 5) Final deterministic tiebreaker: exact wait time, oldest first.
    const aTime = a.lastAssistanceAt ? new Date(a.lastAssistanceAt).getTime() : 0;
    const bTime = b.lastAssistanceAt ? new Date(b.lastAssistanceAt).getTime() : 0;
    return aTime - bTime;
  });

  return enriched;
}

export async function rateTrainer(sessionId, userId, trainerId, rating, helped = true, comment) {
  if (rating < 1 || rating > 5) {
    throw new AppError("Rating must be between 1 and 5", 422);
  }

  const session = await prisma.gymSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new AppError("Session not found", 404);
  if (session.userId !== userId) throw new AppError("Session does not belong to this user", 403);
  if (!session.checkOutAt) {
    throw new AppError("Session must be completed before rating a trainer", 400);
  }

  const validAssistance = await prisma.assistance.findFirst({
    where: {
      userId,
      trainerId,
      status: "COMPLETED",
    },
  });

  if (!validAssistance) {
    throw new AppError("No completed assistance found for this trainer", 400);
  }

  const alreadyRated = await prisma.trainerRating.findFirst({
    where: { userId, trainerId, gymSessionId: sessionId },
  });

  if (alreadyRated) {
    throw new AppError("You have already rated this trainer for this session", 409);
  }

  const trainerRating = await prisma.trainerRating.create({
    data: {
      userId,
      trainerId,
      gymSessionId: sessionId,
      rating,
    },
  });

  await updateTrainerMetrics(trainerId);

  // Feedback is useful to the gym (trainer quality signal) — small reward
  // for actually using this feature. Non-blocking, like other point awards.
  addPoints(userId, POINTS.TRAINER_RATED, "Rated a trainer").catch((err) =>
    logger.error("[gym] Failed to award trainer-rating points:", err.message)
  );

  // "No me ayudaron": the member marked, on the rate-trainer popup, that the
  // trainer didn't actually help them. This automatically becomes a
  // complaint against the trainer, on top of the numeric rating above.
  let complaint = null;
  if (helped === false) {
    complaint = await createAutoNoHelpComplaint({
      reporterId: userId,
      reportedUserId: trainerId,
      gymSessionId: sessionId,
      comment,
    });
  }

  return { rating: trainerRating, complaint };
}