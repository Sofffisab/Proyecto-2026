import prisma from "../config/prisma.js";
import * as gymService from "../services/gym.service.js";

/**
 * Receives a batch of offline-queued actions and processes them in order.
 * Supported actions: "checkin", "checkout", "machineStart", "machineEnd".
 * Each action that fails is included in the response as an error without
 * aborting the rest of the batch.
 *
 * Input is validated by syncActionsSchema before reaching this controller,
 * so `actions` is guaranteed to be a non-empty array of well-typed objects
 * with valid ISO timestamps and UUID payloads where required.
 */
export async function syncOfflineActions(req, res, next) {
  try {
    // req.validatedData is guaranteed by syncActionsSchema — no manual
    // array/length check needed here.
    const { actions } = req.validatedData;
    const results = [];

    // Reject timestamps that are obviously wrong — more than 7 days in
    // the past or any amount in the future. Online check-ins always use server
    // time; offline sync must still be within a reasonable window.
    const MAX_PAST_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now          = Date.now();

    for (const action of actions) {
      try {
        // Validate timestamp range before processing
        const actionTime = new Date(action.timestamp).getTime();
        if (isNaN(actionTime)) {
          results.push({ type: action.type, success: false, error: "Invalid timestamp" });
          continue;
        }
        if (actionTime > now) {
          results.push({ type: action.type, success: false, error: "Timestamp is in the future" });
          continue;
        }
        if (now - actionTime > MAX_PAST_MS) {
          results.push({ type: action.type, success: false, error: "Timestamp is too old (> 7 days)" });
          continue;
        }

        let result = null;

        if (action.type === "checkin") {
          // IMPORTANT: go through gymService.checkIn instead of writing the
          // GymSession row directly. A raw prisma.create here used to skip
          // points awarding AND the real-time "student needs attention"
          // trainer alert (notifyAbandoningTrainersOnCheckIn) — meaning a
          // check-in synced late from an offline queue would silently never
          // notify a trainer, even though the student may be on the floor
          // right now. gymService.checkIn always alerts using the current
          // moment (alertNow, default true) regardless of how old the
          // synced checkInAt timestamp is, since that's what real-time
          // attention requires.
          result = await gymService.checkIn(req.user.id, {
            checkInAt: new Date(action.timestamp),
          });
        } else if (action.type === "checkout") {
          const session = await prisma.gymSession.findFirst({
            where: { userId: req.user.id, checkOutAt: null },
            orderBy: { checkInAt: "desc" },
          });

          if (session) {
            const checkOutAt = new Date(action.timestamp);
            const durationMinutes = Math.floor(
              (checkOutAt - new Date(session.checkInAt)) / (1000 * 60)
            );

            result = await prisma.gymSession.update({
              where: { id: session.id },
              data: { checkOutAt, durationMinutes },
            });
          }
        } else if (action.type === "machineStart") {
          result = await prisma.machineUsage.create({
            data: {
              userId: req.user.id,
              machineId: action.payload.machineId,
              gymSessionId: action.payload.gymSessionId ?? null,
              startedAt: new Date(action.timestamp),
            },
          });
        } else if (action.type === "machineEnd") {
          const usage = await prisma.machineUsage.findFirst({
            where: {
              userId: req.user.id,
              machineId: action.payload.machineId,
              endedAt: null,
            },
            orderBy: { startedAt: "desc" },
          });

          if (usage) {
            const endedAt = new Date(action.timestamp);
            const durationMinutes = Math.floor(
              (endedAt - new Date(usage.startedAt)) / (1000 * 60)
            );

            result = await prisma.machineUsage.update({
              where: { id: usage.id },
              data: { endedAt, durationMinutes },
            });
          }
        }

        results.push({ type: action.type, success: true, data: result });
      } catch (err) {
        results.push({ type: action.type, success: false, error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
}