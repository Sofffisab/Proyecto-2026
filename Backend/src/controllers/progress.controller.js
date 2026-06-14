import * as progressService from "../services/progress.service.js";

export async function add(req, res, next) {
  try {
    const data = await progressService.addProgress(
      req.user.id,
      req.body.goalId,
      req.body.value
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function history(req, res, next) {
  try {
    const data = await progressService.getProgressHistory(
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function stats(req, res, next) {
  try {
    const data = await progressService.getProgressStats(
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}