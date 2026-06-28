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

export async function reviewRequest(req, res, next) {
  try {
    // req.validatedData from pointReviewRequestSchema guarantees { reason } is present
    // and non-empty — no manual check needed here.
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
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function resolveReviewRequest(req, res, next) {
  try {
    const data = await prisma.pointReviewRequest.update({
      where: { id: req.params.id },
      data: { resolved: true, reviewedBy: req.user.id },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}