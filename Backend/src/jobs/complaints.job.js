import prisma from "../config/prisma.js";
import { logger } from "../utils/logger.js";

const AUTO_CLOSE_AFTER_DAYS = 30;

/**
 * Processes pending complaints:
 * - Auto-closes complaints that have been pending for more than AUTO_CLOSE_AFTER_DAYS
 * without any admin action (marks them as REJECTED with an automated note stored
 * in the `resolution` field, reviewedAt timestamp, and reviewedBy as null for system audit).
 */
export async function processComplaints() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AUTO_CLOSE_AFTER_DAYS);

  const stale = await prisma.complaint.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (stale.length === 0) {
    logger.info("[complaints.job] No stale complaints to process.");
    return;
  }

  const ids = stale.map((c) => c.id);

  await prisma.complaint.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "REJECTED",
      reviewedBy: null, 
      reviewedAt: new Date(),
      resolution: `Auto-closed after ${AUTO_CLOSE_AFTER_DAYS} days with no admin action.`,
    },
  });

  logger.info(`[complaints.job] Auto-closed ${ids.length} stale complaint(s).`);
}