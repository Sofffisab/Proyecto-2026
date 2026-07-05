import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { emitUserNeedsAttention } from "../realtime/ably.js";
import { notifyTrainerOfReturningStudent } from "./communication.service.js";
import { AppError } from "../utils/errors.js";

// Emit USER_NEEDS_ATTENTION when a user has been waiting this many minutes without assistance
const ATTENTION_THRESHOLD_MINUTES = parseInt(process.env.ATTENTION_THRESHOLD_MINUTES ?? "30", 10);

// Alert a trainer on check-in if it's been at least this many days since they
// last assisted this specific student (or they've never assisted them at all).
const ABANDONMENT_ALERT_THRESHOLD_DAYS = parseInt(process.env.ABANDONMENT_ALERT_THRESHOLD_DAYS ?? "14", 10);

export async function checkIn(userId) {
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

  const session = await prisma.gymSession.create({
    data: {
      userId,
      checkInAt: new Date(),
    },
  });

  // Award check-in points (non-blocking)
  addPoints(userId, POINTS.CHECK_IN, "Gym check-in").catch((err) =>
    console.error("[gym] Failed to award check-in points:", err.message)
  );

  // Alert trainer(s) who haven't helped this student in a long time that
  // they just walked in (non-blocking — never delay the check-in response).
  notifyAbandoningTrainersOnCheckIn(userId, session.checkInAt).catch((err) =>
    console.error("[gym] Failed to notify trainer(s) of returning student:", err.message)
  );

  return session;
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

    await notifyTrainerOfReturningStudent(trainerId, student, {
      checkInAt,
      daysSinceLastAssistance,
    });
  }
}

export async function checkOut(userId) {
  // Real-world tolerance: if the user never checked in (forgot to scan on
  // the way in, or only used a machine), don't trap them — let them "exit"
  // without it counting as a real gym visit rather than throwing an error.
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
    return { noActiveSession: true };
  }

  const checkOutAt = new Date();
  const durationMinutes = Math.round((checkOutAt - session.checkInAt) / 60000);

  const updated = await prisma.gymSession.update({
    where: { id: session.id },
    data: { checkOutAt, durationMinutes, autoClosed: false },
  });

  // Award check-out points (non-blocking)
  addPoints(userId, POINTS.CHECK_OUT, "Gym check-out").catch((err) =>
    console.error("[gym] Failed to award check-out points:", err.message)
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

  // Emit USER_NEEDS_ATTENTION for users who have been waiting too long
  const now = Date.now();
  for (const session of enriched) {
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
 * Strict ordering (per product requirement):
 *   1) Not helped in the longest time (never-helped users first).
 *   2) Trainer's specialty matches the student's goal/objective.
 *   3) Student's explicit trainer preference.
 *   4) Seniority as a member (older members first).
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
  // objectives is a flexible JSON field: accept either an array of strings,
  // or an array of objects with a `type`/`goal` field.
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

  enriched.sort((a, b) => {
    // 1) Longest without help first (never helped = oldest possible time)
    const aTime = a.lastAssistanceAt ? new Date(a.lastAssistanceAt).getTime() : 0;
    const bTime = b.lastAssistanceAt ? new Date(b.lastAssistanceAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;

    // 2) Trainer specialty matches the student's goal
    if (a.specialtyMatch !== b.specialtyMatch) return a.specialtyMatch ? -1 : 1;

    // 3) Student's explicit preference for this trainer
    if (a.prefersThisTrainer !== b.prefersThisTrainer) return a.prefersThisTrainer ? -1 : 1;

    // 4) Seniority as a member (older account first)
    return new Date(a.user.createdAt).getTime() - new Date(b.user.createdAt).getTime();
  });

  return enriched;
}

export async function rateTrainer(sessionId, userId, trainerId, rating) {
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

  return trainerRating;
}