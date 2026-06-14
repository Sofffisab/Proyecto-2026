import * as routineService from "../services/routine.service.js";

export async function getAll(req, res, next) {
  try {
    const data = await routineService.getRoutines(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const data = await routineService.createRoutine(
      req.user.id,
      req.body
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const data = await routineService.updateRoutine(
      req.params.id,
      req.body
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const data = await routineService.deleteRoutine(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}