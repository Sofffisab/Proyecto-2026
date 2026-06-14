import * as challengeService from "../services/challenge.service.js";

export async function assign(req, res, next) {
  try {
    const data = await challengeService.assignChallenge(
      req.user.id,
      req.body.partnerUserId,
      req.body.station
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function accept(req, res, next) {
  try {
    const data = await challengeService.acceptChallenge(
      req.params.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function reject(req, res, next) {
  try {
    const data = await challengeService.rejectChallenge(
      req.params.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function complete(req, res, next) {
  try {
    const data = await challengeService.completeChallenge(
      req.params.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}