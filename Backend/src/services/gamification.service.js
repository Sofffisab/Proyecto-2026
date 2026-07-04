import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { createNotification, sendEmail } from "./communication.service.js";
import { autoGrantRewards } from "./reward.service.js";
import { POINTS } from "../constants/points.js";

export async function addPoints(userId, points, reason) {
  if (!points || points <= 0) {
    throw new Error("Points must be positive");
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
    console.error("[gamification] Failed to auto-grant rewards:", err.message);
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

export async function getLeaderboard({ limit = 10, offset = 0 } = {}) {
  const cacheKey = `leaderboard:${limit}:${offset}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, totalPoints: true },
    orderBy: { totalPoints: "desc" },
    take: limit,
    skip: offset,
  });

  const ranked = users.map((u, i) => ({ ...u, rank: offset + i + 1 }));

  if (redis) await redis.set(cacheKey, JSON.stringify(ranked));

  return ranked;
}