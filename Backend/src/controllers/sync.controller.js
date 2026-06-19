import prisma from "../config/prisma.js";

/**
 * Recibe un batch de acciones encoladas offline y las procesa en orden.
 * Acciones soportadas: "checkin", "checkout", "machineStart", "machineEnd".
 * Cada acción que falla se incluye en la respuesta como error sin abortar el resto.
 *
 * Body esperado:
 * { actions: [{ type: string, payload: object, timestamp: string }] }
 */
export async function syncOfflineActions(req, res, next) {
  try {
    const { actions } = req.body;

    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "actions must be a non-empty array",
      });
    }

    const results = [];

    for (const action of actions) {
      try {
        let result = null;

        if (action.type === "checkin") {
          result = await prisma.gymSession.create({
            data: {
              userId: req.user.id,
              checkInAt: new Date(action.timestamp),
            },
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
              gymSessionId: action.payload.gymSessionId,
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
        } else {
          result = { skipped: true, reason: `Unknown action type: ${action.type}` };
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