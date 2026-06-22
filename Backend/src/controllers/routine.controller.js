import * as routineService from "../services/routine.service.js";

export async function getUserRoutines(req, res, next) {
  try {
    const data = await routineService.getRoutines(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRoutineById(req, res, next) {
  try {
    const routine = await routineService.getRoutineById(req.params.id, req.user.id);
    if (!routine) {
      return res.status(404).json({ success: false, message: "Routine not found" });
    }
    res.json({ success: true, data: routine });
  } catch (err) {
    next(err);
  }
}

export async function createRoutine(req, res, next) {
  try {
    const data = await routineService.createRoutine(req.user.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateRoutine(req, res, next) {
  try {
    const data = await routineService.updateRoutine(req.params.id, req.user.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteRoutine(req, res, next) {
  try {
    await routineService.deleteRoutine(req.params.id, req.user.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

export async function completeDay(req, res, next) {
  try {
    const data = await routineService.completeDay(
      req.params.id,
      req.user.id,
      req.body.dayIndex
    );
    res.json({ success: true, data });
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