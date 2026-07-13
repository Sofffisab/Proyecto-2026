import * as challengeService from "../services/challenge.service.js";
import { validateQRPayload } from "../services/verification.service.js";
import { AppError } from "../utils/errors.js";

// SocialChallenges are never created via a form: either auto-assigned
// (jobs/challenge.job.js) or paired instantly via QR exchange (scanUser below)

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

// POST /challenges/scan-user — instant pairing via QR exchange, no user search
export async function scanUser(req, res, next) {
  try {
    const { payload, station } = req.validatedData;
    const parsed = validateQRPayload(payload);

    if (parsed.type !== "USER") {
      throw new AppError("This QR code does not belong to a user", 400);
    }
    if (!parsed.userId) {
      throw new AppError("Missing userId in QR payload", 400);
    }

    const data = await challengeService.pairFromScan(req.user.id, parsed.userId, station);
    res.status(201).json({ success: true, data });
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

// Legacy aliases for old naming
export { getActive as getActiveChallenges, getAll as getAllChallenges };