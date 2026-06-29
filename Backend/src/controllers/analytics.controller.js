import * as insightsService from "../services/insights.service.js";
import * as engagementService from "../services/engagement.service.js";

export async function getUserAnalytics(req, res, next) {
  try {
    const data = await insightsService.getUserAnalytics(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGymAnalytics(req, res, next) {
  try {
    const data = await insightsService.getGymAnalytics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGlobalLeaderboard(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit ?? "20", 10), 100);
    const data = await engagementService.getLeaderboardWithNames(limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUserRank(req, res, next) {
  try {
    const { rank, totalPoints } = await engagementService.getUserRank(req.user.id);
    res.json({ success: true, data: { rank, totalPoints } });
  } catch (err) {
    next(err);
  }
}