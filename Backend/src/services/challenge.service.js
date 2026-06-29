import prisma from "../config/prisma.js";
import { POINTS } from "../constants/points.js";
import { addPoints } from "./gamification.service.js";
import { AppError } from "../utils/errors.js";

export async function assignChallenge(userIdA, userIdB, station) {
  if (userIdA === userIdB) {
    throw new AppError("A user cannot challenge themselves", 400);
  }

  const [settingsA, settingsB] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: userIdA } }),
    prisma.userSettings.findUnique({ where: { userId: userIdB } }),
  ]);

  if (settingsA?.disableSocial || settingsB?.disableSocial) {
    throw new AppError("One or both users have social challenges disabled", 400);
  }

  const [sessionA, sessionB] = await Promise.all([
    prisma.gymSession.findFirst({ where: { userId: userIdA, checkOutAt: null } }),
    prisma.gymSession.findFirst({ where: { userId: userIdB, checkOutAt: null } }),
  ]);

  if (!sessionA) throw new AppError("The first user does not have an active gym session", 400);
  if (!sessionB) throw new AppError("The second user does not have an active gym session", 400);

  const existing = await prisma.socialChallenge.findFirst({
    where: {
      OR: [
        { userId: userIdA, partnerUserId: userIdB },
        { userId: userIdB, partnerUserId: userIdA },
      ],
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
  });

  if (existing) {
    throw new AppError("An active challenge already exists between these users", 409);
  }

  return prisma.socialChallenge.create({
    data: {
      userId: userIdA,
      partnerUserId: userIdB,
      station,
      status: "ASSIGNED",
    },
  });
}

export async function acceptChallenge(challengeId, userId) {
  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError("Challenge not found", 404);
  if (challenge.partnerUserId !== userId) throw new AppError("Forbidden: Only the challenged partner can accept", 403);
  if (challenge.status !== "ASSIGNED") throw new AppError("Challenge cannot be accepted in its current state", 400);

  return prisma.socialChallenge.update({
    where: { id: challengeId },
    data: { status: "ACCEPTED" },
  });
}

export async function rejectChallenge(challengeId, callerId) {
  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError("Challenge not found", 404);

  if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
    throw new AppError("Forbidden", 403);
  }

  const allowed = ["ASSIGNED", "ACCEPTED"];
  if (!allowed.includes(challenge.status)) {
    throw new AppError("Challenge cannot be cancelled in its current state", 400);
  }

  const previousStatus = challenge.status;

  const updated = await prisma.socialChallenge.update({
    where: { id: challengeId },
    data: { status: "REJECTED" },
  });

  if (previousStatus === "ACCEPTED") {
    await addPoints(challenge.partnerUserId, POINTS.SOCIAL_CHALLENGE_ATTEMPTED);
  }

  return updated;
}

export async function completeChallengeByQR(challengeId, callerId, partnerId) {
  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError("Challenge not found", 404);

  const isUserA = challenge.userId === callerId && challenge.partnerUserId === partnerId;
  const isUserB = challenge.partnerUserId === callerId && challenge.userId === partnerId;
  if (!isUserA && !isUserB) {
    throw new AppError("Provided partnerId does not match this challenge match-up", 400);
  }

  if (challenge.status !== "ACCEPTED") {
    throw new AppError("Challenge must be ACCEPTED by the partner before it can be completed", 400);
  }

  const updated = await prisma.socialChallenge.update({
    where: { id: challengeId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await Promise.all([
    addPoints(challenge.userId, POINTS.SOCIAL_CHALLENGE_COMPLETED),
    addPoints(challenge.partnerUserId, POINTS.SOCIAL_CHALLENGE_COMPLETED),
  ]);

  return updated;
}

export async function getChallengeLeaderboard(challengeId) {
  const completions = await prisma.socialChallenge.groupBy({
    by: ["userId", "partnerUserId"],
    where: {
      status: "COMPLETED",
      station: {
        some: {}
      }
    },
    _count: { id: true },
  });

  const countMap = {};
  completions.forEach((c) => {
    countMap[c.userId] = (countMap[c.userId] || 0) + c._count.id;
    countMap[c.partnerUserId] = (countMap[c.partnerUserId] || 0) + c._count.id;
  });

  const userIds = Object.keys(countMap);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  return users
    .map((u) => ({ ...u, completedChallenges: countMap[u.id] ?? 0 }))
    .sort((a, b) => b.completedChallenges - a.completedChallenges);
}

export async function getActiveChallenges(userId) {
  return prisma.socialChallenge.findMany({
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getChallengeHistory(userId) {
  return prisma.socialChallenge.findMany({
    where: { OR: [{ userId }, { partnerUserId: userId }] },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getActiveSocialChallenges(userId) {
  return getActiveChallenges(userId);
}