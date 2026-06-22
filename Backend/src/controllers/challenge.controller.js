import * as challengeService from "../services/challenge.service.js";

export async function createChallenge(req, res, next) {
  try {
    const data = await challengeService.assignChallenge(
      req.body.userIdA,
      req.body.userIdB,
      req.body.station
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getActiveChallenges(req, res, next) {
  try {
    const data = await challengeService.getActiveChallenges(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAllChallenges(req, res, next) {
  try {
    const data = await challengeService.getChallengeHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getChallengeById(req, res, next) {
  try {
    const challenge = await challengeService.getChallengeById(
      req.params.id,
      req.user.id
    );
    if (!challenge) {
      return res.status(404).json({ success: false, message: "Challenge not found" });
    }
    res.json({ success: true, data: challenge });
  } catch (err) {
    next(err);
  }
}

export async function joinChallenge(req, res, next) {
  try {
    const data = await challengeService.acceptChallenge(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function completeChallenge(req, res, next) {
  try {
    const data = await challengeService.completeChallengeByQR(
      req.params.id,
      req.user.id,
      req.body.partnerId
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function cancelChallenge(req, res, next) {
  try {
    const data = await challengeService.rejectChallenge(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getChallengeLeaderboard(req, res, next) {
  try {
    const data = await challengeService.getChallengeLeaderboard(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getActive(req, res, next) {
  try {
    const data = await challengeService.getActiveSocialChallenges(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req, res, next) {
  try {
    const data = await challengeService.getSocialHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}