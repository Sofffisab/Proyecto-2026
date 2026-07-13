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

// Exposes the learned behavior profile (frequent days/hour, top machines,
// consistency score) so the app and other engines can use it.
export async function getUserPatterns(req, res, next) {
  try {
    const data = await behaviorAnalysisService.getUserBehaviorProfile(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Exposes the engagement metrics endpoint
export async function getEngagementMetrics(req, res, next) {
  try {
    const data = await engagementService.getEngagementMetrics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Admin-only: full user history, pseudonymized (see utils/privacy.js).
// ?identified=true attaches real name/email, only for users who kept consent.
export async function getFullHistoryAdmin(req, res, next) {
  try {
    const includeIdentifiers = req.query.identified === "true";
    const data = await insightsService.getFullHistoryAdmin({ includeIdentifiers });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
