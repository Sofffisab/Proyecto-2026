import * as progressService from "../services/progress.service.js";

export async function createProgress(req, res, next) {
  try {
    const { goalId, value } = req.validatedData;
    const data = await progressService.addProgress(req.user.id, goalId, value);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProgress(req, res, next) {
  try {
    const data = await progressService.getProgressHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getProgressById(req, res, next) {
  try {
    const entry = await progressService.getProgressEntryById(req.params.id, req.user.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: "Progress entry not found" });
    }
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function updateProgress(req, res, next) {
  try {
    // req.validatedData is already whitelisted by updateProgressSchema { value?, note? }.
    // No need to destructure manually — the schema guarantees only allowed fields exist.
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

// ── Goals ────────────────────────────────────────────────────────────────────

import * as goalService from "../services/progress.service.js";

export async function createGoal(req, res, next) {
  try {
    const data = await goalService.createGoal(req.user.id, req.validatedData);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGoals(req, res, next) {
  try {
    const data = await goalService.getGoals(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getGoalById(req, res, next) {
  try {
    const goal = await goalService.getGoalById(req.params.id, req.user.id);
    if (!goal) return res.status(404).json({ success: false, message: "Goal not found" });
    res.json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
}

export async function updateGoal(req, res, next) {
  try {
    const data = await goalService.updateGoal(req.params.id, req.user.id, req.validatedData);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteGoal(req, res, next) {
  try {
    await goalService.deleteGoal(req.params.id, req.user.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}