import prisma from "../config/prisma.js";
import { POINTS } from "../constants/points.js";

export async function assignChallenge(userIdA, userIdB, station) {
  // Prevent self-challenge
  if (userIdA === userIdB) {
    throw new Error("A user cannot challenge themselves");
  }

  const [settingsA, settingsB] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: userIdA } }),
    prisma.userSettings.findUnique({ where: { userId: userIdB } }),
  ]);

  if (settingsA?.disableSocial || settingsB?.disableSocial) {
    throw new Error("One or both users have social challenges disabled");
  }

  // Both users must currently be in the gym
  const [sessionA, sessionB] = await Promise.all([
    prisma.gymSession.findFirst({ where: { userId: userIdA, checkOutAt: null } }),
    prisma.gymSession.findFirst({ where: { userId: userIdB, checkOutAt: null } }),
  ]);

  if (!sessionA) {
    throw new Error("The first user does not have an active gym session");
  }
  if (!sessionB) {
    throw new Error("The second user does not have an active gym session");
  }

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
    throw new Error("An active challenge already exists between these users");
  }

  return prisma.socialChallenge.create({
    data: {
      userId: userIdA,
      partnerUserId: userIdB,
      station,
      status: "ASSIGNED",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
}

export async function acceptChallenge(challengeId, callerId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({ where: { id: challengeId } });

    if (!challenge) throw new Error("Challenge not found");

    if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
      throw new Error("Not a participant of this challenge");
    }

    if (challenge.status !== "ASSIGNED") {
      throw new Error(`Cannot accept a challenge with status: ${challenge.status}`);
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "ACCEPTED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: callerId,
        targetUserId:
          callerId === challenge.userId ? challenge.partnerUserId : challenge.userId,
        type: "CHALLENGE_ACCEPTED",
      },
    });

    return updated;
  });
}

export async function rejectChallenge(challengeId, callerId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({ where: { id: challengeId } });

    if (!challenge) throw new Error("Challenge not found");

    if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
      throw new Error("Not a participant of this challenge");
    }

    if (!["ASSIGNED", "ACCEPTED"].includes(challenge.status)) {
      throw new Error(`Cannot reject a challenge with status: ${challenge.status}`);
    }

    // Award attempted points INSIDE the transaction so they roll back if the update fails
    if (challenge.status === "ACCEPTED") {
      const participantWhoAccepted =
        callerId === challenge.userId ? challenge.partnerUserId : challenge.userId;

      await tx.pointTransaction.create({
        data: {
          userId: participantWhoAccepted,
          points: POINTS.SOCIAL_CHALLENGE_ATTEMPTED,
          reason: "Social challenge attempted (partner rejected)",
        },
      });
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "REJECTED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: callerId,
        targetUserId:
          callerId === challenge.userId ? challenge.partnerUserId : challenge.userId,
        type: "CHALLENGE_REJECTED",
      },
    });

    return updated;
  });
}

export async function completeChallengeByQR(challengeId, scannerId, scannedId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({ where: { id: challengeId } });

    if (!challenge) throw new Error("Challenge not found");

    const participantIds = [challenge.userId, challenge.partnerUserId];
    if (!participantIds.includes(scannerId) || !participantIds.includes(scannedId)) {
      throw new Error("Both users must be participants of this challenge");
    }

    if (challenge.status !== "ACCEPTED") {
      throw new Error("Challenge must be in ACCEPTED status to be completed");
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "COMPLETED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: scannerId,
        targetUserId: scannedId,
        type: "CHALLENGE_COMPLETED",
      },
    });

    // Award points to both participants inside the transaction
    await tx.pointTransaction.create({
      data: {
        userId: challenge.userId,
        points: POINTS.SOCIAL_CHALLENGE_COMPLETED,
        reason: "Social challenge completed",
      },
    });
    await tx.pointTransaction.create({
      data: {
        userId: challenge.partnerUserId,
        points: POINTS.SOCIAL_CHALLENGE_COMPLETED,
        reason: "Social challenge completed",
      },
    });

    return updated;
  });
}

export async function getChallengeById(id, callerId) {
  const challenge = await prisma.socialChallenge.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!challenge) return null;

  // Ensure the caller is a participant
  if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
    return null;
  }

  return challenge;
}

export async function getChallengeLeaderboard(challengeId) {
  const interactions = await prisma.socialInteraction.findMany({
    where: { type: "CHALLENGE_COMPLETED" },
    select: { userId: true },
  });

  const countMap = interactions.reduce((acc, i) => {
    acc[i.userId] = (acc[i.userId] || 0) + 1;
    return acc;
  }, {});

  const userIds = Object.keys(countMap);
  if (userIds.length === 0) return [];

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

export async function getSocialHistory(userId) {
  return prisma.socialInteraction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      target: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
}