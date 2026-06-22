import prisma from "../config/prisma.js";

/**
 * Recalculates total points for every user from their PointTransaction records
 * and caches the result in the UserPoints table (if present) or logs a summary.
 *
 * This job exists as a consistency check / repair tool in case individual
 * addPoints calls fail silently. It is NOT the primary source of points —
 * PointTransaction records are.
 */
export async function recalculatePoints() {
  let users;

  try {
    users = await prisma.user.findMany({ select: { id: true } });
  } catch (err) {
    console.error("[points.job] Failed to fetch users:", err.message);
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

      // Upsert into UserPoints cache table if it exists in the schema.
      // If the model doesn't exist yet this will throw and be caught below.
      await prisma.userPoints.upsert({
        where: { userId: user.id },
        update: { totalPoints: total, updatedAt: new Date() },
        create: { userId: user.id, totalPoints: total },
      }).catch(() => {
        // UserPoints table may not exist yet — log instead of crashing the job
        console.log(`[points.job] User ${user.id} total: ${total} pts (cache not persisted)`);
      });

      processed++;
    } catch (err) {
      console.error(`[points.job] Failed to process user ${user.id}:`, err.message);
      failed++;
    }
  }

  console.log(`[points.job] Done — ${processed} processed, ${failed} failed`);
}