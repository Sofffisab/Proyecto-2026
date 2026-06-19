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
  const transactions = await prisma.pointTransaction.findMany({
    where: { userId },
  });

  const total = transactions.reduce((acc, t) => acc + t.points, 0);

  return {
    totalPoints: total,
    transactions,
  };
}

export async function unlockAchievement(userId, achievementId) {
  // Wrapped in a transaction: both the achievement record and the
  // points reward are created atomically — if one fails, neither persists.
  return prisma.$transaction(async (tx) => {
    const achievement = await tx.achievement.findUnique({
      where: { id: achievementId },
    });

    if (!achievement) throw new Error("Achievement not found");

    const userAchievement = await tx.userAchievement.create({
      data: { userId, achievementId },
    });

    // Award points for unlocking the achievement
    if (achievement.pointsRequired > 0) {
      await tx.pointTransaction.create({
        data: {
          userId,
          points: achievement.pointsRequired,
          reason: `Achievement unlocked: ${achievement.name}`,
        },
      });
    }

    return userAchievement;
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