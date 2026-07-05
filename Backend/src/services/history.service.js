import prisma from "../config/prisma.js";
import { AppError } from "../utils/errors.js";

/**
 * Get complete interaction history for a user:
 * - Trainers who assisted them
 * - Social challenge partners they completed challenges with
 * Both include name and date of interaction
 */
export async function getInteractionHistory(userId) {
  // Get all completed assistance records (trainer interactions)
  const trainerInteractions = await prisma.assistance.findMany({
    where: {
      userId,
      status: "COMPLETED",
      trainerId: { not: null },
    },
    include: {
      trainer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  // Get all completed social challenges
  const socialChallenges = await prisma.socialChallenge.findMany({
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
      status: "COMPLETED",
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      partner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  // Format trainer interactions
  const formattedTrainerInteractions = trainerInteractions.map((assistance) => ({
    type: "TRAINER_ASSISTANCE",
    partnerId: assistance.trainer.id,
    partnerName: `${assistance.trainer.firstName} ${assistance.trainer.lastName}`,
    date: assistance.completedAt,
    machineId: assistance.machineId,
    machineName: assistance.machine?.name ?? null,
    rating: assistance.trainerRating,
  }));

  // Format social challenge interactions
  const formattedSocialInteractions = socialChallenges.map((challenge) => {
    const isOwner = challenge.userId === userId;
    const partner = isOwner ? challenge.partner : challenge.user;

    return {
      type: "SOCIAL_CHALLENGE",
      partnerId: partner.id,
      partnerName: `${partner.firstName} ${partner.lastName}`,
      date: challenge.completedAt,
      challengeId: challenge.id,
    };
  });

  // Combine and sort by date
  const allInteractions = [
    ...formattedTrainerInteractions,
    ...formattedSocialInteractions,
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return allInteractions;
}

/**
 * Get daily machine usage log grouped by date
 * Shows which machines were used on each day, duration, and times
 */
export async function getDailyMachineUsageLog(userId) {
  const usages = await prisma.machineUsage.findMany({
    where: { userId },
    include: {
      machine: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  // Group by date (YYYY-MM-DD)
  const groupedByDate = {};

  usages.forEach((usage) => {
    const dateKey = usage.startedAt.toISOString().split("T")[0];

    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }

    groupedByDate[dateKey].push({
      machineId: usage.machine.id,
      machineName: usage.machine.name,
      startedAt: usage.startedAt,
      endedAt: usage.endedAt,
      durationMinutes: usage.durationMinutes,
    });
  });

  // Convert to array of days
  const dailyLog = Object.entries(groupedByDate)
    .map(([date, machines]) => ({
      date,
      machinesUsed: machines.length,
      totalDurationMinutes: machines.reduce((sum, m) => sum + (m.durationMinutes ?? 0), 0),
      machines: machines.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt)),
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return dailyLog;
}

/**
 * Get trainer's detailed assistance history
 * Shows student name, machine used, date, and rating for each assistance session
 */
export async function getTrainerAssistanceHistory(trainerId) {
  const assistances = await prisma.assistance.findMany({
    where: {
      trainerId,
      status: "COMPLETED",
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      machine: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  return assistances.map((assistance) => ({
    assistanceId: assistance.id,
    studentId: assistance.user.id,
    studentName: `${assistance.user.firstName} ${assistance.user.lastName}`,
    machineId: assistance.machine?.id ?? null,
    machineName: assistance.machine?.name ?? null,
    date: assistance.completedAt,
    rating: assistance.trainerRating,
    requestedAt: assistance.requestedAt,
  }));
}

/**
 * Check if user has an active ACCEPTED_BY_BOTH challenge
 * Used to enforce machine access restrictions
 */
export async function userHasActiveChallenge(userId) {
  const challenge = await prisma.socialChallenge.findFirst({
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
      status: "ACCEPTED_BY_BOTH",
    },
  });

  return challenge ?? null;
}