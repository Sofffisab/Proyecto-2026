import * as routineService from "../services/routine.service.js";

export async function getUserRoutines(req, res, next) {
  try {
    const data = await routineService.getRoutines(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getRoutineById(req, res, next) {
  try {
    const routines = await routineService.getRoutines(req.user.id);
    const found = routines.find((r) => r.id === req.params.id);
    if (!found) return res.status(404).json({ success: false, message: "Routine not found" });
    res.json(found);
  } catch (err) {
    next(err);
  }
}

export async function createRoutine(req, res, next) {
  try {
    const data = await routineService.createRoutine(req.user.id, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateRoutine(req, res, next) {
  try {
    const data = await routineService.updateRoutine(
      req.params.id,
      req.user.id,
      req.body
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteRoutine(req, res, next) {
  try {
    const data = await routineService.deleteRoutine(req.params.id, req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function completeDay(req, res, next) {
  try {
    res.json({ success: true, message: "Day completed" });
  } catch (err) {
    next(err);
  }
}

export async function getSuggestion(req, res, next) {
  try {
    const data = await routineService.getSuggestion(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function requestPersonalized(req, res, next) {
  try {
    const data = await routineService.createRoutineRequest(
      req.user.id,
      req.body.trainerId
    );
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}