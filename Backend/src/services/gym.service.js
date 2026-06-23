import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { emitUserNeedsAttention } from "../realtime/ably.js";

// Emit USER_NEEDS_ATTENTION when a user has been waiting this many minutes without assistance
const ATTENTION_THRESHOLD_MINUTES = parseInt(process.env.ATTENTION_THRESHOLD_MINUTES ?? "30", 10);

export async function checkIn(userId) {
  // Prevent duplicate open sessions
  const existing = await prisma.gymSession.findFirst({
    where: { userId, checkOutAt: null },
  });

  if (existing) {
    throw new Error("User already has an active session. Check out first.");
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

  return session;
}

export async function checkOut(userId) {
  const session = await prisma.gymSession.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  if (!session) throw new Error("No active session");

  const checkOutAt = new Date();
  const durationMinutes = Math.round((checkOutAt - session.checkInAt) / 60000);

  const updated = await prisma.gymSession.update({
    where: { id: session.id },
    data: { checkOutAt, durationMinutes },
  });

  // Award check-out points (non-blocking)
  addPoints(userId, POINTS.CHECK_OUT, "Gym check-out").catch((err) =>
    console.error("[gym] Failed to award check-out points:", err.message)
  );

  return updated;
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
          settings: { select: { trainerPreference: true } },
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

  // Bug 16: emit USER_NEEDS_ATTENTION for users who have been waiting too long
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

export async function rateTrainer(sessionId, userId, trainerId, rating) {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const session = await prisma.gymSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new Error("Session not found");
  if (session.userId !== userId) throw new Error("Session does not belong to this user");
  if (!session.checkOutAt) {
    throw new Error("Session must be completed before rating a trainer");
  }

  const validAssistance = await prisma.assistance.findFirst({
    where: {
      userId,
      trainerId,
      status: "COMPLETED",
    },
  });

  if (!validAssistance) {
    throw new Error("No completed assistance found for this trainer");
  }

  const alreadyRated = await prisma.trainerRating.findFirst({
    where: { userId, trainerId, gymSessionId: sessionId },
  });

  if (alreadyRated) {
    throw new Error("You have already rated this trainer for this session");
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