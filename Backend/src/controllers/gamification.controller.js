import * as gamificationService from "../services/gamification.service.js";
import * as engagementService from "../services/engagement.service.js";
import * as wrappedService from "../services/wrapped.service.js";
import { AppError } from "../utils/errors.js";
import prisma from "../config/prisma.js";

export async function getUserPoints(req, res, next) {
  try {
    const data = await gamificationService.getPoints(req.user.id);
    res.json({ success: true, data }); // Here `data` will be the points
  } catch (err) {
    next(err);
  }
}

// GET /gamification/badges  (routes calls this name)
export async function getUserBadges(req, res, next) {
  try {
    const data = await gamificationService.getAchievements(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /gamification/achievements
export async function getAllAchievements(req, res, next) {
  try {
    // The underlying service call was already correctly named
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

// GET /analytics/wrapped
export async function getWrapped(req, res, next) {
  try {
    const year = parseInt(req.query.year ?? new Date().getFullYear(), 10);
    const data = await wrappedService.generateWrapped(req.user.id, year);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /gamification/review-request  (routes calls this name)
export async function createReviewRequest(req, res, next) {
  try {
    const { reason } = req.validatedData;
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

export async function getReviewRequests(req, res, next) {
  try {
    const data = await prisma.pointReviewRequest.findMany({
      where: { resolved: false },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function resolveReviewRequest(req, res, next) {
  try {
    const existing = await prisma.pointReviewRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new AppError("Review request not found", 404);

    const data = await prisma.pointReviewRequest.update({
      where: { id: req.params.id },
      data: { resolved: true, reviewedBy: req.user.id },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

