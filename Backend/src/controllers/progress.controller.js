import * as progressService from "../services/progress.service.js";

export async function createProgress(req, res, next) {
  try {
    const data = await progressService.addProgress(
      req.user.id,
      req.body.goalId,
      req.body.value
    );
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
    // Whitelist: only allow updating `value` and `note`
    const { value, note } = req.body;
    const data = await progressService.updateProgressEntry(
      req.params.id,
      req.user.id,
      { value, note }
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

export async function getProgressStats(req, res, next) {
  try {
    const data = await progressService.getProgressStats(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}