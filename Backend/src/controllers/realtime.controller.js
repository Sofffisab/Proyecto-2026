import { createStaffTokenRequest } from "../realtime/ably.js";
import { AppError } from "../utils/errors.js";

// GET /staff/ably-token  (TRAINER, ADMIN) — read-only access to the "staff:live" channel.
export async function getStaffAblyToken(req, res, next) {
  try {
    const data = await createStaffTokenRequest(req.user.id);
    if (!data) throw new AppError("Realtime service unavailable", 503);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
