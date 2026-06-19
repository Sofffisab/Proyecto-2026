import * as challengeService from "../services/challenge.service.js";

/**
 * POST /challenges/assign
 * Solo usado internamente o por ADMIN/TRAINER para asignar un desafío entre dos usuarios.
 */
export async function assign(req, res, next) {
  try {
    const data = await challengeService.assignChallenge(
      req.body.userIdA,
      req.body.userIdB,
      req.body.station
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /challenges/:id/accept
 * El usuario autenticado acepta el desafío — debe ser uno de los dos participantes.
 */
export async function accept(req, res, next) {
  try {
    const data = await challengeService.acceptChallenge(
      req.params.id,
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /challenges/:id/reject
 */
export async function reject(req, res, next) {
  try {
    const data = await challengeService.rejectChallenge(
      req.params.id,
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /challenges/active
 */
export async function getActive(req, res, next) {
  try {
    const data = await challengeService.getActiveChallenges(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /challenges/history
 */
export async function getHistory(req, res, next) {
  try {
    const data = await challengeService.getChallengeHistory(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}