import prisma from "../config/prisma.js";


// No rankings/leaderboards of any kind (public, private, or per-challenge) —
// not wanted by the product. Engagement is measured per-user via achievement
// badges (frequency/consistency of attendance, social interactions, machine
// usage), not by comparing users against each other.

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