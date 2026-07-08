import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { createNotification, sendEmail } from "./communication.service.js";
import { autoGrantRewards } from "./reward.service.js";
import { POINTS } from "../constants/points.js";
import { logger } from "../utils/logger.js";
import { computeUserMetrics } from "./achievementMetrics.service.js";

export async function addPoints(userId, points, reason) {
  // Points can be negative (penalties, e.g. complaint.service.js#approveComplaint)
  // or positive (rewards); only reject missing/zero/non-numeric values.
  if (typeof points !== "number" || Number.isNaN(points) || points === 0) {
    throw new Error("Points must be a non-zero number");
  }

  const transaction = await prisma.pointTransaction.create({
    data: { userId, points, reason },
  });

  // NOTE: leaderboards/public rankings remain intentionally out of scope
  // (see routes/index.js). Automatic achievement unlocking IS wanted, but is
  // NOT triggered from here — it's evaluated from the specific activity
  // that changes each metric (gym check-in/out for streaks, machine usage
  // ending, social challenge completion) so it always sees fresh data. See
  // checkAndUnlockAchievements below and its callers in gym.service.js,
  // verification.service.js and challenge.service.js.
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

// Whether a given achievement's target has been reached, given the user's
// current totalPoints and the freshly-computed per-metric values from
// achievementMetrics.service.js. TOTAL_POINTS keeps using the legacy
// `pointsRequired` field; every other metric uses `threshold`.
function isAchievementEarned(achievement, totalPoints, metrics) {
  if (achievement.metric === "TOTAL_POINTS") {
    return totalPoints >= achievement.pointsRequired;
  }
  const value = metrics[achievement.metric];
  return typeof value === "number" && value >= achievement.threshold;
}

// Personal badge collection: evaluates every Achievement definition against
// this user's current stats (points, attendance streaks, social
// interactions, machine usage) and unlocks any newly-earned ones. This is
// purely personal — there is no public catalog to pick from and no
// leaderboard; see routes/index.js for why those were intentionally left out.
export async function checkAndUnlockAchievements(userId) {
  const agg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  const totalPoints = agg?._sum?.points ?? 0;

  const metrics = await computeUserMetrics(userId);

  const unlockedIds = (await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  })) || [];
  const unlockedSet = new Set(unlockedIds.map((u) => u.achievementId));

  const allAchievements = (await prisma.achievement.findMany()) || [];
  const eligible = allAchievements.filter(
    (achievement) => !unlockedSet.has(achievement.id) && isAchievementEarned(achievement, totalPoints, metrics)
  );

  for (const achievement of eligible) {
    // Atomic: both the unlock record and the bonus points are created together
    const unlocked = await prisma.$transaction(async (tx) => {
      // Double-check inside transaction to prevent race conditions
      const alreadyUnlocked = await tx.userAchievement.findFirst({
        where: { userId, achievementId: achievement.id },
      });
      if (alreadyUnlocked) return false;

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

      return true;
    });

    if (!unlocked) continue;

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

// Badges are never claimed manually — only checkAndUnlockAchievements above
// grants them, so there is no way for a user to self-award one without
// actually meeting its threshold.
export async function getAchievements(userId) {
  return prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });
}

// No leaderboard/ranking of any kind, public or private — not wanted by
// the product. Engagement is measured entirely through personal achievement
// badges (see checkAndUnlockAchievements above), not by comparing users.