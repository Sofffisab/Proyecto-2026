import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { addPoints, checkAndUnlockAchievements } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { emitUserNeedsAttention } from "../realtime/ably.js";
import { notifyTrainerOfReturningStudent } from "./communication.service.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { createAutoNoHelpComplaint } from "./complaint.service.js";
import { MESSAGES } from "../locales/es.js";

// Minutes without assistance before triggering USER_NEEDS_ATTENTION
const ATTENTION_THRESHOLD_MINUTES = parseInt(process.env.ATTENTION_THRESHOLD_MINUTES ?? "30", 10);

// Days without assistance to a student before alerting a trainer on check-in
const ABANDONMENT_ALERT_THRESHOLD_DAYS = parseInt(process.env.ABANDONMENT_ALERT_THRESHOLD_DAYS ?? "14", 10);

// Bucket size (minutes) used for wait-time grouping in getPriorityAssistanceList
const PRIORITY_LIST_WAIT_BUCKET_MINUTES = parseInt(
  process.env.PRIORITY_LIST_WAIT_BUCKET_MINUTES ?? "15",
  10
);

export async function checkIn(userId, options = {}) {
  // checkInAt: real check-in moment (used for offline sync)
  const { checkInAt: requestedCheckInAt, alertNow = true } = options;

  // If a session is already open (double scan), return it instead of erroring
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

  // Check if check-in unlocks a consistency achievement (non-blocking)
  Promise.resolve(checkAndUnlockAchievements(userId)).catch((err) =>
    logger.error("[gym] Failed to check achievements on check-in:", err.message)
  );

  // Notify trainers who abandoned this student (uses real "now", even for offline sync)
  if (alertNow) {
    notifyAbandoningTrainersOnCheckIn(userId, new Date()).catch((err) =>
      logger.error("[gym] Failed to notify trainer(s) of returning student:", err.message)
    );
  }

  return session;
}

/** Describes where a student currently is (active machine/zone, or "just checked in"). */
export async function getUserCurrentLocation(userId) {
  // With machine-tracking opt-out, only "present in gym" is known
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

  if (!activeSession) return MESSAGES.LOCATION_UNKNOWN;

  return settings?.machineTrackingOptOut
    ? MESSAGES.LOCATION_GYM_UNTRACKED_MACHINE
    : MESSAGES.LOCATION_JUST_CHECKED_IN;
}

/** Notifies trainers (preferred + past ones) who passed the days-without-assistance threshold for this student. */
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

    // Recomputed in case time passed between check-in and this loop
    const location = await getUserCurrentLocation(userId);

    await notifyTrainerOfReturningStudent(trainerId, student, {
      checkInAt,
      daysSinceLastAssistance,
      location,
    });
  }
}

export async function checkOut(userId) {
  // No open session is a 400 error. An auto-closed session (by the expiration
  // cron) still counts as current if the user later scans a real check-out.
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

  // Leaving the gym also closes any active machine usage.
  // Dynamic import avoids a require-cycle with verification.service.js.
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

/** Reopens a session that was auto-closed once something confirms the user is still at the gym (e.g. scanned a machine). */
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
  // Users with an active session (single query, avoids N+1)
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

  // Last completed assistance per user (single query)
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

  // Alert USER_NEEDS_ATTENTION only for users who didn't disable assistance
  // (they can still ask for help manually without this proactive nudge)
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

  // Sort: longest wait first (most urgent)
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
 * Trainer-facing priority assistance list. Sorted by 4 cascading criteria:
 * 1) wait bucket (minutes without assistance, grouped in PRIORITY_LIST_WAIT_BUCKET_MINUTES steps)
 * 2) specialty match with the student's goal
 * 3) student's explicit preference for this trainer
 * 4) membership seniority (oldest first), then exact wait time as final tiebreaker.
 * Excludes users with `disableAssistance` enabled.
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

  // Student objectives vs trainer specialties. The o?.goal fallback
  // is compatibility with legacy rows from when this was free-form JSON.
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

  // Never assisted = infinite wait, sorts first
  function waitBucket(lastAssistanceAt) {
    if (!lastAssistanceAt) return Number.POSITIVE_INFINITY;
    const waitedMs = now - new Date(lastAssistanceAt).getTime();
    return Math.floor(waitedMs / bucketMs);
  }

  enriched.forEach((s) => {
    s.waitBucket = waitBucket(s.lastAssistanceAt);
  });

  enriched.sort((a, b) => {
    // 1) wait bucket (larger = more urgent)
    if (a.waitBucket !== b.waitBucket) return b.waitBucket - a.waitBucket;

    // 2) trainer specialty vs student's goal
    if (a.specialtyMatch !== b.specialtyMatch) return a.specialtyMatch ? -1 : 1;

    // 3) student's explicit trainer preference
    if (a.prefersThisTrainer !== b.prefersThisTrainer) return a.prefersThisTrainer ? -1 : 1;

    // 4) seniority as a member
    const seniorityDiff = new Date(a.user.createdAt).getTime() - new Date(b.user.createdAt).getTime();
    if (seniorityDiff !== 0) return seniorityDiff;

    // 5) final tiebreaker: exact wait time
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

  // Award trainer-rating points (non-blocking)
  addPoints(userId, POINTS.TRAINER_RATED, "Rated a trainer").catch((err) =>
    logger.error("[gym] Failed to award trainer-rating points:", err.message)
  );

  // If marked "didn't help me", also auto-generate a complaint
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