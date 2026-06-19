import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";

export async function assignChallenge(userIdA, userIdB, station) {
  const [settingsA, settingsB] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: userIdA } }),
    prisma.userSettings.findUnique({ where: { userId: userIdB } }),
  ]);

  if (settingsA?.disableSocial || settingsB?.disableSocial) {
    throw new Error("One or both users have social challenges disabled");
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
    const challenge = await tx.socialChallenge.findUnique({
      where: { id: challengeId },
    });

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
          callerId === challenge.userId
            ? challenge.partnerUserId
            : challenge.userId,
        type: "CHALLENGE_ACCEPTED",
      },
    });

    return updated;
  });
}

export async function rejectChallenge(challengeId, callerId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) throw new Error("Challenge not found");

    if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
      throw new Error("Not a participant of this challenge");
    }

    if (!["ASSIGNED", "ACCEPTED"].includes(challenge.status)) {
      throw new Error(`Cannot reject a challenge with status: ${challenge.status}`);
    }

    if (challenge.status === "ACCEPTED") {
      const participantWhoAccepted =
        callerId === challenge.userId
          ? challenge.partnerUserId
          : challenge.userId;

      await addPoints(
        participantWhoAccepted,
        POINTS.SOCIAL_CHALLENGE_ATTEMPTED,
        "Social challenge attempted (partner rejected)"
      );
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "REJECTED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: callerId,
        targetUserId:
          callerId === challenge.userId
            ? challenge.partnerUserId
            : challenge.userId,
        type: "CHALLENGE_REJECTED",
      },
    });

    return updated;
  });
}

export async function completeChallengeByQR(challengeId, scannerId, scannedId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({
      where: { id: challengeId },
    });

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

    await addPoints(
      challenge.userId,
      POINTS.SOCIAL_CHALLENGE_COMPLETED,
      "Social challenge completed"
    );
    await addPoints(
      challenge.partnerUserId,
      POINTS.SOCIAL_CHALLENGE_COMPLETED,
      "Social challenge completed"
    );

    return updated;
  });
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
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Error 14: active social challenges for the current user
export async function getActiveSocialChallenges(userId) {
  return getActiveChallenges(userId);
}

// Error 15: social interaction history with target user details
export async function getSocialHistory(userId) {
  return prisma.socialInteraction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      target: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
}