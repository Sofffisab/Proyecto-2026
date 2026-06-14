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

export async function acceptChallenge(challengeId) {
  const challenge =
    await prisma.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "ACCEPTED" },
    });

  // crear interacción de historial inicial
  await prisma.socialInteraction.create({
    data: {
      userId: challenge.userId,
      targetUserId: challenge.partnerUserId,
      type: "CHALLENGE_ACCEPTED",
    },
  });

  return challenge;
}

export async function rejectChallenge(challengeId) {
  const challenge =
    await prisma.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "REJECTED" },
    });

  await prisma.socialInteraction.create({
    data: {
      userId: challenge.userId,
      targetUserId: challenge.partnerUserId,
      type: "CHALLENGE_REJECTED",
    },
  });

  return challenge;
}

export async function completeChallenge(challengeId) {
  const challenge =
    await prisma.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "COMPLETED" },
    });

  await prisma.socialInteraction.create({
    data: {
      userId: challenge.userId,
      targetUserId: challenge.partnerUserId,
      type: "CHALLENGE_COMPLETED",
    },
  });

  return challenge;
}