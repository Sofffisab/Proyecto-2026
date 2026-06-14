import prisma from "../config/prisma.js";

export async function addPoints(userId, points, reason) {
  return prisma.pointTransaction.create({
    data: {
      userId,
      points,
      reason,
    },
  });
}

export async function getPoints(userId) {
  const transactions =
    await prisma.pointTransaction.findMany({
      where: { userId },
    });

  const total = transactions.reduce(
    (acc, t) => acc + t.points,
    0
  );

  return {
    totalPoints: total,
    transactions,
  };
}

export async function unlockAchievement(userId, achievementId) {
  return prisma.userAchievement.create({
    data: {
      userId,
      achievementId,
    },
  });
}

export async function getAchievements(userId) {
  return prisma.userAchievement.findMany({
    where: { userId },
    include: {
      achievement: true,
    },
  });
}