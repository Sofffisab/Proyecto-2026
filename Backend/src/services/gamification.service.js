import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { createNotification, sendEmail } from "./communication.service.js";
import { autoGrantRewards } from "./reward.service.js";
import { POINTS } from "../constants/points.js";
import { logger } from "../utils/logger.js";

export async function addPoints(userId, points, reason) {
  // Points can be negative (penalties, e.g. complaint.service.js#approveComplaint)
  // or positive (rewards); only reject missing/zero/non-numeric values.
  if (typeof points !== "number" || Number.isNaN(points) || points === 0) {
    throw new Error("Points must be a non-zero number");
  }

  const transaction = await prisma.pointTransaction.create({
    data: { userId, points, reason },
  });

  // NOTE: automatic achievement unlocking + leaderboards were intentionally
  // removed — the product no longer wants a catalog the user picks from,
  // achievement pop-ups, or public rankings. Prizes are granted automatically
  // by point threshold and shipped by the gym (see reward.service.js).
  try {
    await autoGrantRewards(userId);
  } catch (err) {
    logger.error("[gamification] Failed to auto-grant rewards:", err.message);
  }

  return transaction;
}

export async function getPoints(userId) {
  // Use aggregate for the total — avoids loading every transaction into memory
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });

  const transactions = await prisma.pointTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50, // paginate — don't load the entire history into memory
  });

  return { totalPoints: agg._sum.points ?? 0, transactions };
}

export async function checkAndUnlockAchievements(userId) {
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  const totalPoints = agg?._sum?.points ?? 0;

  const unlockedIds = (await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  })) || [];
  const unlockedSet = new Set(unlockedIds.map((u) => u.achievementId));

  const eligible = (await prisma.achievement.findMany({
    where: { pointsRequired: { lte: totalPoints } },
  })) || [];

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

      // Use the constant — not a hardcoded literal
      await tx.pointTransaction.create({
        data: {
          userId,
          points: POINTS.ACHIEVEMENT_UNLOCKED,
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
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId } },
  });

  if (existing) throw new Error("Achievement already unlocked");

  const userAchievement = await prisma.userAchievement.create({
    data: { userId, achievementId, unlockedAt: new Date() },
  });

  await prisma.pointTransaction.create({
    data: {
      userId,
      points: POINTS.ACHIEVEMENT_UNLOCKED,
      reason: `Achievement unlocked: ${achievementId}`,
    },
  });

  return userAchievement;
}

export async function getAchievements(userId) {
  return prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });
}

// NOTE: getLeaderboard was removed — it referenced a `User.totalPoints`
// field that doesn't exist in schema.prisma and was never wired to any
// route (public/global leaderboards were intentionally dropped from the
// product; see routes/index.js). Use engagement.service.js#getLeaderboard
// (backed by PointTransaction aggregation) for the admin-only equivalent.