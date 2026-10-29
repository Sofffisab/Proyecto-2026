import * as socialService from "../services/social.service.js";

// GET /social/state — everything the app needs on start-up/reconnect, in one request
export async function getState(req, res, next) {
  try {
    const data = await socialService.getSocialState(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /social/ably-token — token request for the Ably client (clientId = user id)
export async function getAblyToken(req, res, next) {
  try {
    const data = await socialService.getRealtimeToken(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /social/tick — run a matching round (cheap no-op if one already ran)
export async function tick(req, res, next) {
  try {
    const data = await socialService.runMatchingRound(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /social/:id/respond { accept } — Yes/No on the invitation pop-up
export async function respond(req, res, next) {
  try {
    const data = await socialService.respondToChallenge(
      req.user.id,
      req.params.id,
      req.validatedData.accept
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /social/:id/cancel — "cerrar" on any of the pop-ups
export async function cancel(req, res, next) {
  try {
    const data = await socialService.cancelChallenge(req.user.id, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
