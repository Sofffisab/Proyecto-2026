import { prisma } from "../config/index.js";
import { logger } from "../utils/logger.js";

// Consistency check: recomputes each user's total points from PointTransaction
// (source of truth) and logs it. Not persisted anywhere yet.
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

      logger.info(`[points.job] User ${user.id} total: ${total} pts`);

      processed++;
    } catch (err) {
      logger.error(`[points.job] Failed to process user ${user.id}:`, err.message);
      failed++;
    }
  }

  logger.info(`[points.job] Done — ${processed} processed, ${failed} failed`);
}