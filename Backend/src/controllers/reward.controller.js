import * as rewardService from "../services/reward.service.js";

export async function redeem(req, res, next) {
  try {
    const data = await rewardService.generateReward(
      req.user.id,
      req.body.rewardId
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function approve(req, res, next) {
  try {
    const data = await rewardService.approveReward(
      req.params.id,
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function ship(req, res, next) {
  try {
    const data = await rewardService.shipReward(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deliver(req, res, next) {
  try {
    const data = await rewardService.deliverReward(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}