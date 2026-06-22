import * as routineService from "../services/routine.service.js";

export async function create(req, res, next) {
  try {
    const data = await routineService.createRoutine(req.user.id, req.validatedData);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAll(req, res, next) {
  try {
    const data = await routineService.getRoutines(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
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

export async function update(req, res, next) {
  try {
    const data = await routineService.updateRoutine(req.params.id, req.user.id, req.validatedData);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await routineService.deleteRoutine(req.params.id, req.user.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

export async function requestRoutine(req, res, next) {
  try {
    // trainerId is optional — user may request without specifying a trainer
    const trainerId = req.body?.trainerId ?? null;
    const data = await routineService.createRoutineRequest(req.user.id, trainerId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRequests(req, res, next) {
  try {
    // Trainers/admins see all pending; users see their own.
    const data = await routineService.getRoutineRequests(req.user.id, req.user.role);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function acceptRequest(req, res, next) {
  try {
    const data = await routineService.acceptRoutineRequest(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const data = await routineService.rejectRoutineRequest(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function completeRequest(req, res, next) {
  try {
    const data = await routineService.completeRoutineRequest(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}