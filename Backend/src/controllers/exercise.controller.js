import * as exerciseService from "../services/exercise.service.js";

// GET /routines/exercises?muscle=chest&q=press
export async function list(req, res, next) {
  try {
    const { muscle, q } = req.query;
    const data = await exerciseService.listExercises(req.user.id, {
      muscle: exerciseService.MUSCLE_GROUPS.includes(muscle) ? muscle : undefined,
      q: typeof q === "string" ? q : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /routines/exercises — "Crear ejercicio propio"
export async function create(req, res, next) {
  try {
    const data = await exerciseService.createCustomExercise(req.user.id, req.validatedData);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
