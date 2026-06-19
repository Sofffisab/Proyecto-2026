import * as analyticsService from '../services/analytics.service.js';
import prisma from '../config/prisma.js';

export async function getUserAnalytics(req, res, next) {
  try {
    const data = await analyticsService.getUserAnalytics(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getGymAnalytics(req, res, next) {
  try {
    const data = await analyticsService.getGymAnalytics();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getGlobalLeaderboard(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const rows = await prisma.pointTransaction.groupBy({
      by: ['userId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    const leaderboard = await Promise.all(
      rows.map(async (row, index) => {
        const user = await prisma.user.findUnique({
          where: { id: row.userId },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        });
        return { rank: index + 1, user, totalPoints: row._sum.points ?? 0 };
      })
    );

    res.json(leaderboard);
  } catch (err) {
    next(err);
  }
}

export async function getUserRank(req, res, next) {
  try {
    const rows = await prisma.pointTransaction.groupBy({
      by: ['userId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
    });

    const userPoints = rows.find((r) => r.userId === req.user.id)?._sum.points ?? 0;
    const rank = rows.findIndex((r) => r.userId === req.user.id) + 1;

    res.json({ rank: rank || null, totalPoints: userPoints, totalUsers: rows.length });
  } catch (err) {
    next(err);
  }
}

export async function getEngagementMetrics(req, res, next) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [activeUsers, monthlySessions, completedChallenges, pendingComplaints] =
      await Promise.all([
        prisma.user.count({ where: { isActive: true } }),
        prisma.gymSession.count({ where: { checkInAt: { gte: startOfMonth } } }),
        prisma.userChallenge.count({ where: { status: 'COMPLETED' } }),
        prisma.complaint.count({ where: { status: 'PENDING' } }),
      ]);

    res.json({ activeUsers, monthlySessions, completedChallenges, pendingComplaints });
  } catch (err) {
    next(err);
  }
}