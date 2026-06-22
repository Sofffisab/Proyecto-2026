import * as gamificationService from "../services/gamification.service.js";
import * as engagementService from "../services/engagement.service.js";
import * as insightsService from "../services/insights.service.js";
import prisma from "../config/prisma.js";

export async function getPoints(req, res, next) {
  try {
    const data = await gamificationService.getPoints(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAchievements(req, res, next) {
  try {
    const data = await gamificationService.getAchievements(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBadges(req, res, next) {
  try {
    const data = await gamificationService.getAchievements(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAllBadges(req, res, next) {
  try {
    const data = await engagementService.getAllAchievements();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function claimBadge(req, res, next) {
  try {
    const data = await gamificationService.unlockAchievement(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getWrapped(req, res, next) {
  try {
    const data = await insightsService.getWrapped(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a PointReviewRequest so the user can dispute a points decision.
 * Previously this mistakenly called addPoints(userId, 0, ...) which did nothing.
 */
export async function reviewRequest(req, res, next) {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, message: "reason is required" });
    }

    const request = await prisma.pointReviewRequest.create({
      data: {
        userId: req.user.id,
        reason,
        resolved: false,
      },
    });

    res.status(201).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
}