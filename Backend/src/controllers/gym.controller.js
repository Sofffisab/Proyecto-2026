import * as gymService from "../services/gym.service.js";

export async function checkIn(req, res, next) {
  try {
    const session = await gymService.checkIn(req.user.id);
    // Consistent API contract: always wrap in { success, data }
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function checkOut(req, res, next) {
  try {
    const session = await gymService.checkOut(req.user.id);
    // Consistent API contract: always wrap in { success, data }
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function getSessionHistory(req, res, next) {
  try {
    const data = await gymService.getSessionHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getSessionById(req, res, next) {
  try {
    const data = await gymService.getSessionById(req.params.id, req.user.id);
    if (!data) return res.status(404).json({ success: false, message: "Session not found" });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function presentUsers(req, res, next) {
  try {
    const users = await gymService.getPresentUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

export async function rateTrainer(req, res, next) {
  try {
    const result = await gymService.rateTrainer(
      req.params.id,
      req.user.id,
      req.validatedData.trainerId,
      req.validatedData.rating
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
// Fix #13: return the authenticated user's current session status
export async function getGymStatus(req, res, next) {
  try {
    const session = await gymService.getCurrentSession(req.user.id);
    res.json({ success: true, data: { isCheckedIn: !!session, session: session ?? null } });
  } catch (err) {
    next(err);
  }
}
