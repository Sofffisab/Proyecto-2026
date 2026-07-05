import * as insightsService from "../services/insights.service.js";
import * as engagementService from "../services/engagement.service.js";
import * as behaviorAnalysisService from "../services/behaviorAnalysis.service.js";

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
// Exposes the learned behavior profile (frequent days/hour, top machines,
// detected recurring routines, consistency score) so the app can show the
// user their own patterns and so other engines can be built on top of it.
export async function getUserPatterns(req, res, next) {
  try {
    const data = await behaviorAnalysisService.getUserBehaviorProfile(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Fix #12: expose engagement metrics endpoint
export async function getEngagementMetrics(req, res, next) {
  try {
    const data = await engagementService.getEngagementMetrics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
