import * as gamificationService from "../services/gamification.service.js";

export async function points(req, res, next) {
  try {
    const data = await gamificationService.getPoints(
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function achievements(req, res, next) {
  try {
    const data =
      await gamificationService.getAchievements(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function reviewRequest(req, res, next) {
  try {
    const data =
      await gamificationService.addPoints(
        req.user.id,
        0,
        "REVIEW_REQUEST"
      );

    res.json(data);
  } catch (err) {
    next(err);
  }
}