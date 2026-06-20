import * as analyticsService from "../services/analytics.service.js";
import * as engagementService from "../services/engagement.service.js";
import prisma from "../config/prisma.js";

export async function getUserAnalytics(req, res, next) {
  try {
    const data = await analyticsService.getUserAnalytics(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGymAnalytics(req, res, next) {
  try {
    const data = await analyticsService.getGymAnalytics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGlobalLeaderboard(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 100);
    const raw = await engagementService.getLeaderboard(limit);

    // Enrich with user display names
    const userIds = raw.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const data = raw.map((r, index) => ({
      rank: index + 1,
      userId: r.userId,
      firstName: userMap[r.userId]?.firstName ?? "",
      lastName: userMap[r.userId]?.lastName ?? "",
      totalPoints: r.totalPoints,
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUserRank(req, res, next) {
  try {
    const leaderboard = await engagementService.getLeaderboard(1000);
    const rank = leaderboard.findIndex((r) => r.userId === req.user.id) + 1;
    const entry = leaderboard.find((r) => r.userId === req.user.id);

    res.json({
      success: true,
      data: {
        rank: rank > 0 ? rank : null,
        totalPoints: entry?.totalPoints ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getEngagementMetrics(req, res, next) {
  try {
    const [totalUsers, activeUsers, totalSessions, totalPoints] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.gymSession.count(),
        prisma.pointTransaction.aggregate({ _sum: { points: true } }),
      ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalSessions,
        totalPointsAwarded: totalPoints._sum.points ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
}