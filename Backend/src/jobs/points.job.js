import prisma from "../config/prisma.js";
import { logger } from "../utils/logger.js";

/**
 * Recalculates total points for every user from their PointTransaction records
 * and logs a summary.
 *
 * This job is a consistency check / repair tool in case individual addPoints
 * calls fail silently. It is NOT the primary source of points — PointTransaction
 * records are the source of truth.
 *
 * NOTE: The UserPoints cache table does not exist in schema.prisma.
 * If a denormalised cache is needed for performance, add the model to the schema
 * and re-enable the upsert below. Until then the job only logs the totals.
 */
export async function recalculatePoints() {
  let users;

  try {
    users = await prisma.user.findMany({ select: { id: true } });
  } catch (err) {
    logger.error("[points.job] Failed to fetch users:", err.message);
    throw err;
  }

  let processed = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const agg = await prisma.pointTransaction.aggregate({
        where: { userId: user.id },
        _sum: { points: true },
      });

      const total = agg._sum.points ?? 0;

      // Log the result. To persist this to a cache table, add the UserPoints
      // model to prisma/schema.prisma and replace this log with an upsert.
      logger.info(`[points.job] User ${user.id} total: ${total} pts`);

      processed++;
    } catch (err) {
      logger.error(`[points.job] Failed to process user ${user.id}:`, err.message);
      failed++;
    }
  }

  logger.info(`[points.job] Done — ${processed} processed, ${failed} failed`);
}