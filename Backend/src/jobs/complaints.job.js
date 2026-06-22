import prisma from "../config/prisma.js";

const AUTO_CLOSE_AFTER_DAYS = 30;

/**
 * Processes pending complaints:
 * - Auto-closes complaints that have been pending for more than AUTO_CLOSE_AFTER_DAYS
 *   without any admin action (marks them as REJECTED with an automated note).
 *
 * Future: add scoring / AI rules for automatic resolution.
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
    console.log("[complaints.job] No stale complaints to process.");
    return;
  }

  const ids = stale.map((c) => c.id);

  await prisma.complaint.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "REJECTED",
      resolution: `Auto-closed after ${AUTO_CLOSE_AFTER_DAYS} days with no admin action.`,
    },
  });

  console.log(`[complaints.job] Auto-closed ${ids.length} stale complaint(s).`);
}