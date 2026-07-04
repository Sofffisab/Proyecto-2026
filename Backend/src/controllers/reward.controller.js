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
    const data = await rewardService.rejectReward(req.params.id, req.user.id);
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
// Fix #14: list all redemptions for admin view
export async function getAllRedemptions(req, res, next) {
  try {
    const data = await rewardService.getAllRedemptions();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Fix #14: unified status-transition endpoint for admin (approve/reject/ship/deliver)
export async function updateRedemptionStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let data;
    switch (status) {
      case "APPROVED":
        data = await rewardService.approveReward(id, req.user.id);
        break;
      case "REJECTED":
        data = await rewardService.rejectReward(id, req.user.id);
        break;
      case "SHIPPED":
        data = await rewardService.shipReward(id);
        break;
      case "DELIVERED":
        data = await rewardService.deliverReward(id);
        break;
      default:
        return res.status(400).json({ success: false, message: `Invalid status: ${status}. Allowed: APPROVED, REJECTED, SHIPPED, DELIVERED` });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
