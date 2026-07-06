import * as rewardService from "../services/reward.service.js";

export async function getAvailableRewards(req, res, next) {
  try {
    const data = await rewardService.getAvailableRewards();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUserRedemptions(req, res, next) {
  try {
    const data = await rewardService.getUserRedemptions(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRewardById(req, res, next) {
  try {
    const reward = await rewardService.getRewardById(req.params.id);
    if (!reward) {
      return res.status(404).json({ success: false, message: "Reward not found" });
    }
    res.json({ success: true, data: reward });
  } catch (err) {
    next(err);
  }
}

// Admin-only: full catalog including stock levels and marketing/merchandising flag.
export async function getAllRewardsAdmin(req, res, next) {
  try {
    const data = await rewardService.getAllRewardsAdmin();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createReward(req, res, next) {
  try {
    const data = await rewardService.createReward(req.validatedData);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateReward(req, res, next) {
  try {
    const data = await rewardService.updateReward(req.params.id, req.validatedData);
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

// Admin view of every automatic reward grant (already shipped).
export async function getAllRedemptions(req, res, next) {
  try {
    const data = await rewardService.getAllRedemptions();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Rewards are granted and shipped automatically — the only admin-driven
// transition left is marking a shipped reward as physically DELIVERED.
export async function updateRedemptionStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== "DELIVERED") {
      return res.status(400).json({
        success: false,
        message: `Invalid status: ${status}. Allowed: DELIVERED`,
      });
    }

    const data = await rewardService.deliverReward(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
