import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";

export async function checkIn(userId) {
  return prisma.gymSession.create({
    data: {
      userId,
      checkInAt: new Date(),
    },
  });
}

export async function checkOut(userId) {
  const session = await prisma.gymSession.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  if (!session) throw new Error("No active session");

  const checkOutAt = new Date();
  const durationMinutes = Math.round((checkOutAt - session.checkInAt) / 60000);

  return prisma.gymSession.update({
    where: { id: session.id },
    data: { checkOutAt, durationMinutes },
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
  // Fetch all users currently checked in
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

  // For each user, find when they last received assistance
  const enriched = await Promise.all(
    activeSessions.map(async (session) => {
      const lastAssistance = await prisma.assistance.findFirst({
        where: { userId: session.userId, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      });

      return {
        ...session,
        lastAssistanceAt: lastAssistance?.completedAt ?? null,
      };
    })
  );

  // Sort: longest since last assistance first, then by trainerPreference, then by seniority
  enriched.sort((a, b) => {
    const aTime = a.lastAssistanceAt ? new Date(a.lastAssistanceAt).getTime() : 0;
    const bTime = b.lastAssistanceAt ? new Date(b.lastAssistanceAt).getTime() : 0;

    if (aTime !== bTime) return aTime - bTime; // oldest assistance first (most urgent)

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