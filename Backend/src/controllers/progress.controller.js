import * as progressService from "../services/progress.service.js";
import { AppError } from "../utils/errors.js";

// POST /progress  (routes calls addProgressLog)
export async function addProgressLog(req, res, next) {
  try {
    const { goalId, value } = req.validatedData;
    const data = await progressService.addProgress(req.user.id, goalId, value);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /progress/history  (routes calls getProgressHistory)
export async function getProgressHistory(req, res, next) {
  try {
    const data = await progressService.getProgressHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /progress/:id  (routes calls updateProgressLog)
export async function updateProgressLog(req, res, next) {
  try {
    const data = await progressService.updateProgressEntry(
      req.params.id,
      req.user.id,
      req.validatedData
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProgressById(req, res, next) {
  try {
    const entry = await progressService.getProgressEntryById(req.params.id, req.user.id);
    if (!entry) throw new AppError("Progress entry not found", 404);
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function deleteProgress(req, res, next) {
  try {
    await progressService.deleteProgressEntry(req.params.id, req.user.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req, res, next) {
  try {
    const data = await progressService.getProgressStats(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Goals

export async function createGoal(req, res, next) {
  try {
    const data = await progressService.createGoal(req.user.id, req.validatedData);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGoals(req, res, next) {
  try {
    const data = await progressService.getGoals(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGoalById(req, res, next) {
  try {
    const goal = await progressService.getGoalById(req.params.id, req.user.id);
    if (!goal) throw new AppError("Goal not found", 404);
    res.json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
}

export async function updateGoal(req, res, next) {
  try {
    const data = await progressService.updateGoal(req.params.id, req.user.id, req.validatedData);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteGoal(req, res, next) {
  try {
    await progressService.deleteGoal(req.params.id, req.user.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}
