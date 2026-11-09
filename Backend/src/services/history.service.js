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

// Trainer's detailed assistance history: who they helped, when, on which
// machine, for how long and how the member rated it.
export async function getTrainerAssistanceHistory(trainerId) {
  const assistances = await prisma.assistance.findMany({
    where: { trainerId, status: "COMPLETED" },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      machine: { select: { id: true, name: true } },
    },
    orderBy: { completedAt: "desc" },
    take: 200,
  });
  if (!assistances || assistances.length === 0) return [];

  // The rating a member leaves in the exit pop-up comes after the help: take
  // the first one this member gave this trainer from then on.
  const ratings = await prisma.trainerRating.findMany({
    where: { trainerId, userId: { in: [...new Set(assistances.map((a) => a.userId))] } },
    orderBy: { createdAt: "asc" },
    select: { userId: true, rating: true, createdAt: true },
  });

  return assistances.map((a) => {
    const rating = (ratings ?? []).find(
      (r) => r.userId === a.userId && new Date(r.createdAt) >= new Date(a.completedAt ?? a.requestedAt)
    );
    const startedAt = a.assignedAt ?? a.requestedAt;
    const minutes = a.completedAt ? Math.max(1, Math.round((new Date(a.completedAt) - new Date(startedAt)) / 60000)) : null;
    return {
      assistanceId: a.id,
      studentId: a.user.id,
      studentName: `${a.user.firstName ?? ""} ${a.user.lastName ?? ""}`.trim() || a.user.email,
      machineId: a.machine?.id ?? null,
      machineName: a.machine?.name ?? null,
      date: a.completedAt,
      minutes,
      rating: rating?.rating ?? null,
      requestedAt: a.requestedAt,
    };
  });
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