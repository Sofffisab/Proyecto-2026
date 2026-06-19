import prisma from "../config/prisma.js";

export async function assignChallenge(userId, partnerUserId, station) {
  return prisma.socialChallenge.create({
    data: {
      userId,
      partnerUserId,
      station,
      status: "ASSIGNED",
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
      throw new Error("Not authorized to accept this challenge");
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "ACCEPTED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: challenge.userId,
        targetUserId: challenge.partnerUserId,
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
      throw new Error("Not authorized to reject this challenge");
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "REJECTED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: challenge.userId,
        targetUserId: challenge.partnerUserId,
        type: "CHALLENGE_REJECTED",
      },
    });

    return updated;
  });
}

export async function completeChallenge(challengeId, callerId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) throw new Error("Challenge not found");

    if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
      throw new Error("Not authorized to complete this challenge");
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "COMPLETED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: challenge.userId,
        targetUserId: challenge.partnerUserId,
        type: "CHALLENGE_COMPLETED",
      },
    });

    return updated;
  });
}