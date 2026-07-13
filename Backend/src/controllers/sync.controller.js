import prisma from "../config/prisma.js";
import * as gymService from "../services/gym.service.js";

/**
 * Processes a batch of offline-queued actions in order (checkin, checkout,
 * machineStart, machineEnd). Failed actions are reported per-item without
 * aborting the rest of the batch. Input already validated by syncActionsSchema.
 */
export async function syncOfflineActions(req, res, next) {
  try {
    const { actions } = req.validatedData;
    const results = [];

    // Reject timestamps more than 7 days old or in the future
    const MAX_PAST_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now          = Date.now();

    for (const action of actions) {
      try {
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
          // Goes through gymService.checkIn (not raw prisma.create) so points
          // and the real-time trainer alert still fire on synced check-ins
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