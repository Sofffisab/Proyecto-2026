import { prisma } from "../config/index.js";
import { AppError } from "../utils/errors.js";

// Full interaction history for a user: trainers who assisted them, and
// social challenge partners, each with name and date.
export async function getInteractionHistory(userId) {
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

  const formattedTrainerInteractions = trainerInteractions.map((assistance) => ({
    type: "TRAINER_ASSISTANCE",
    partnerId: assistance.trainer.id,
    partnerName: `${assistance.trainer.firstName} ${assistance.trainer.lastName}`,
    date: assistance.completedAt,
    machineId: assistance.machineId,
    machineName: assistance.machine?.name ?? null,
    rating: assistance.trainerRating,
  }));

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

  const allInteractions = [
    ...formattedTrainerInteractions,
    ...formattedSocialInteractions,
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return allInteractions;
}

// Daily machine usage log grouped by date (which machines, duration, times).
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

// Trainer's detailed assistance history: student, machine, date, and rating per session.
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

// Whether the user has an active (ACCEPTED, not yet completed) challenge —
// used by verification.service.js to auto-forfeit it if the user scans a
// machine instead of completing the challenge with their partner.
export async function userHasActiveChallenge(userId) {
  const challenge = await prisma.socialChallenge.findFirst({
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
      status: "ACCEPTED",
    },
  });

  return challenge ?? null;
}