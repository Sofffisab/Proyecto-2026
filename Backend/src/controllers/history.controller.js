import * as historyService from "../services/history.service.js";

/** User's complete interaction history: trainers worked with + social challenge partners. */
export async function getInteractionHistory(req, res, next) {
  try {
    const data = await historyService.getInteractionHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** User's daily machine usage log, grouped by date. */
export async function getDailyMachineUsageLog(req, res, next) {
  try {
    const data = await historyService.getDailyMachineUsageLog(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** Trainer's own detailed assistance history. */
export async function getTrainerAssistanceHistory(req, res, next) {
  try {
    const trainerId = req.user.id;
    const data = await historyService.getTrainerAssistanceHistory(trainerId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}