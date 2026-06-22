import prisma from "../config/prisma.js";
import {
  addPoints,
  checkAndUnlockAchievements,
  getPoints,
  getAchievements,
} from "./gamification.service.js";
import { generateReward, approveReward, shipReward, deliverReward } from "./reward.service.js";

// ── Re-exports ────────────────────────────────────────────────────────────────
export { addPoints, getPoints, getAchievements, checkAndUnlockAchievements };
export { generateReward, approveReward, shipReward, deliverReward };

// ── Achievements ──────────────────────────────────────────────────────────────

export async function getAllAchievements() {
  return prisma.achievement.findMany({ orderBy: { pointsRequired: "asc" } });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

/**
 * Returns the top N users by total points using a DB-level groupBy.
 * Does NOT load all users into memory.
 */
export async function getLeaderboard(limit = 20) {
  const transactions = await prisma.pointTransaction.groupBy({
    by: ["userId"],
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  });

  return transactions.map((t) => ({
    userId: t.userId,
    totalPoints: t._sum.points ?? 0,
  }));
}

/**
 * Leaderboard enriched with user display names — single extra query, not N+1.
 */
export async function getLeaderboardWithNames(limit = 20) {
  const rows = await getLeaderboard(limit);
  const userIds = rows.map((r) => r.userId);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return rows.map((r, index) => ({
    rank: index + 1,
    userId: r.userId,
    firstName: userMap[r.userId]?.firstName ?? "",
    lastName: userMap[r.userId]?.lastName ?? "",
    totalPoints: r.totalPoints,
  }));
}

/**
 * Returns rank and total points for a single user.
 * Uses DB groupBy — does NOT load all rows into memory.
 */
export async function getUserRank(userId) {
  // Get the user's own total
  const userAgg = await prisma.pointTransaction.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  const userTotal = userAgg._sum.points ?? 0;

  // Count how many users have strictly more points (their rank is count + 1)
  const usersAbove = await prisma.pointTransaction.groupBy({
    by: ["userId"],
    _sum: { points: true },
    having: { points: { _sum: { gt: userTotal } } },
  });

  return {
    rank: usersAbove.length + 1,
    totalPoints: userTotal,
  };
}

// ── Engagement Metrics ────────────────────────────────────────────────────────

export async function getEngagementMetrics() {
  const [totalUsers, activeUsers, totalSessions, totalPointsAgg] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.gymSession.count(),
    prisma.pointTransaction.aggregate({ _sum: { points: true } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    totalSessions,
    totalPointsAwarded: totalPointsAgg._sum.points ?? 0,
  };
}