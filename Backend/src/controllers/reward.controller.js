import * as rewardService from "../services/reward.service.js";
import prisma from "../config/prisma.js";

export async function getAvailableRewards(req, res, next) {
  try {
    const data = await prisma.reward.findMany({
      where: { active: true },
      orderBy: { pointsCost: "asc" },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUserRedemptions(req, res, next) {
  try {
    const data = await prisma.rewardRedemption.findMany({
      where: { userId: req.user.id },
      include: { reward: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRewardById(req, res, next) {
  try {
    const reward = await prisma.reward.findUnique({
      where: { id: req.params.id },
    });
    if (!reward) {
      return res
        .status(404)
        .json({ success: false, message: "Reward not found" });
    }
    res.json({ success: true, data: reward });
  } catch (err) {
    next(err);
  }
}

export async function redeemReward(req, res, next) {
  try {
    const data = await rewardService.generateReward(
      req.user.id,
      req.params.id
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createReward(req, res, next) {
  try {
    const data = await prisma.reward.create({ data: req.body });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateReward(req, res, next) {
  try {
    const reward = await prisma.reward.findUnique({
      where: { id: req.params.id },
    });
    if (!reward) {
      return res
        .status(404)
        .json({ success: false, message: "Reward not found" });
    }
    const data = await prisma.reward.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function approveRedemption(req, res, next) {
  try {
    const data = await rewardService.approveReward(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function rejectRedemption(req, res, next) {
  try {
    const data = await prisma.rewardRedemption.update({
      where: { id: req.params.id },
      data: { status: "REJECTED" },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function ship(req, res, next) {
  try {
    const data = await rewardService.shipReward(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deliver(req, res, next) {
  try {
    const data = await rewardService.deliverReward(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}