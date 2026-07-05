import * as historyService from "../services/history.service.js";

/**
 * Get user's complete interaction history
 * Shows all trainers they've worked with and social challenge partners
 * Includes name, date, and type of interaction
 */
export async function getInteractionHistory(req, res, next) {
  try {
    const data = await historyService.getInteractionHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * Get user's daily machine usage log
 * Groups machine usage by date, showing which machines were used and for how long
 */
export async function getDailyMachineUsageLog(req, res, next) {
  try {
    const data = await historyService.getDailyMachineUsageLog(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * Get trainer's detailed assistance history
 * Shows student name, machine used, assistance date, and rating
 * Only trainers can access their own history
 */
export async function getTrainerAssistanceHistory(req, res, next) {
  try {
    // Trainers can only view their own history
    const trainerId = req.user.id;
    const data = await historyService.getTrainerAssistanceHistory(trainerId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}