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
    const trainerId = req.validatedData?.trainerId ?? null;
    const data = await routineService.createRoutineRequest(req.user.id, trainerId);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRequests(req, res, next) {
  try {
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

export async function completeDay(req, res, next) {
  try {
    const { id } = req.params;
    const dayIndex = parseInt(req.params.dayIndex, 10);
    const data = await routineService.completeDay(id, dayIndex, req.user.id);
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

export async function getPatternSuggestion(req, res, next) {
  try {
    const data = await routineService.getPatternSuggestion(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function acceptPatternSuggestion(req, res, next) {
  try {
    const data = await routineService.acceptPatternSuggestion(req.user.id, req.validatedData ?? {});
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function rejectPatternSuggestion(req, res, next) {
  try {
    const data = await routineService.rejectPatternSuggestion(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getToday(req, res, next) {
  try {
    const data = await routineService.getTodayOptions(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}