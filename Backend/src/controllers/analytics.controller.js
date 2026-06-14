import * as analyticsService from "../services/analytics.service.js";

export async function me(req, res, next) {
  try {
    const data = await analyticsService.getUserAnalytics(
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function gym(req, res, next) {
  try {
    const data = await analyticsService.getGymAnalytics();
    res.json(data);
  } catch (err) {
    next(err);
  }
}