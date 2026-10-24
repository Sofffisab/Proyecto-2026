import * as scheduleService from "../services/schedule.service.js";
import * as generatorService from "../services/routineGenerator.service.js";

// GET /routines/general
export async function getGeneralRoutines(req, res, next) {
  try {
    const data = await scheduleService.listGeneralRoutines();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /routines/general/:id — one general routine WITH its exercises
export async function getGeneralRoutineById(req, res, next) {
  try {
    const data = await scheduleService.getGeneralRoutine(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /routines/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function getScheduleRange(req, res, next) {
  try {
    const data = await scheduleService.getScheduleRange(req.user.id, req.query.from, req.query.to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /routines/schedule/:date — null when the day has no routine
export async function getScheduleDay(req, res, next) {
  try {
    const data = await scheduleService.getScheduleDay(req.user.id, req.params.date);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /routines/schedule/:date — saves a hand-built day
export async function saveScheduleDay(req, res, next) {
  try {
    const data = await scheduleService.saveScheduleDay(req.user.id, req.params.date, req.validatedData);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// DELETE /routines/schedule/:date
export async function deleteScheduleDay(req, res, next) {
  try {
    const data = await scheduleService.deleteScheduleDay(req.user.id, req.params.date);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /routines/ai/generate — personalized routines from the member's history
export async function generateAiRoutines(req, res, next) {
  try {
    const data = await generatorService.generateRoutines(req.user.id, req.validatedData);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
