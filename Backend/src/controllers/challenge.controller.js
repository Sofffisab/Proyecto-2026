import * as challengeService from "../services/challenge.service.js";

export async function create(req, res, next) {
  try {
    // Use req.validatedData — validated and sanitized by createChallengeSchema.
    // Previously read from req.body directly, bypassing Zod's output entirely.
    const { userIdA, userIdB, station } = req.validatedData;
    const data = await challengeService.assignChallenge(userIdA, userIdB, station);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAll(req, res, next) {
  try {
    const data = await challengeService.getChallengeHistory(req.user.id);
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

export async function getById(req, res, next) {
  try {
    const challenge = await challengeService.getChallengeById(req.params.id, req.user.id);
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

export async function complete(req, res, next) {
  try {
    // req.validatedData from completeChallengeSchema guarantees partnerId is a valid UUID.
    const { partnerId } = req.validatedData;
    const data = await challengeService.completeChallengeByQR(
      req.params.id,
      req.user.id,
      partnerId
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req, res, next) {
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

// Legacy aliases kept for controllers that still reference the old names internally.
export { getActive as getActiveChallenges, getAll as getAllChallenges };