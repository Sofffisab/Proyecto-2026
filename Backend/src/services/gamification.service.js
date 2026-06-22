import prisma from "../config/prisma.js";
import { createNotification, sendEmail } from "./communication.service.js";

export async function addPoints(userId, points, reason) {
  const transaction = await prisma.pointTransaction.create({
    data: { userId, points, reason },
  });

  await checkAndUnlockAchievements(userId);

  return transaction;
}

export async function getPoints(userId) {
  const transactions = await prisma.pointTransaction.findMany({ where: { userId } });
  const total = transactions.reduce((acc, t) => acc + t.points, 0);
  return { totalPoints: total, transactions };
}

export async function checkAndUnlockAchievements(userId) {
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  const totalPoints = agg._sum.points ?? 0;

  const unlockedIds = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const unlockedSet = new Set(unlockedIds.map((u) => u.achievementId));

  const eligible = await prisma.achievement.findMany({
    where: { pointsRequired: { lte: totalPoints } },
  });

  for (const achievement of eligible) {
    if (unlockedSet.has(achievement.id)) continue;

    // Atomic: both the unlock record and the bonus points are created together
    await prisma.$transaction(async (tx) => {
      // Double-check inside transaction to prevent race conditions
      const alreadyUnlocked = await tx.userAchievement.findFirst({
        where: { userId, achievementId: achievement.id },
      });
      if (alreadyUnlocked) return;

      await tx.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });

      await tx.pointTransaction.create({
        data: {
          userId,
          points: 50,
          reason: `Achievement unlocked: ${achievement.name}`,
        },
      });
    });

    // Notify user — non-blocking, outside the transaction
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });

    if (user) {
      createNotification(
        userId,
        "Achievement unlocked! 🏆",
        `Congratulations! You've unlocked the achievement: ${achievement.name}`
      ).catch(() => {});

      sendEmail(
        user.email,
        `Achievement unlocked: ${achievement.name}`,
        `<h2>Congratulations, ${user.firstName}!</h2>
         <p>You've unlocked the achievement <strong>${achievement.name}</strong>. Keep it up!</p>`
      ).catch(() => {});
    }
  }
}

export async function unlockAchievement(userId, achievementId) {
  return prisma.$transaction(async (tx) => {
    const achievement = await tx.achievement.findUnique({ where: { id: achievementId } });
    if (!achievement) throw new Error("Achievement not found");

    const existing = await tx.userAchievement.findFirst({
      where: { userId, achievementId },
    });
    if (existing) throw new Error("Achievement already unlocked");

    const userAchievement = await tx.userAchievement.create({
      data: { userId, achievementId },
    });

    await tx.pointTransaction.create({
      data: {
        userId,
        points: 50,
        reason: `Achievement unlocked: ${achievement.name}`,
      },
    });

    return userAchievement;
  });
}

export async function getAchievements(userId) {
  return prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });
}