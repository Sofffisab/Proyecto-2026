import prisma from "../config/prisma.js";
import { logger } from "../utils/logger.js";

const STALE_AFTER_DAYS = 30;
// A user accumulating this many PENDING complaints against them is treated
// as a suspicious-behavior pattern worth an admin's attention, even before
// any single complaint is decided.
const SUSPICIOUS_COMPLAINT_THRESHOLD = 3;

/**
 * Complaints are never auto-approved or auto-rejected by the system — an
 * admin always makes that call. What this job does instead is surface
 * patterns that deserve active review:
 *  - a user with several PENDING complaints against them at once
 *  - a complaint that has sat PENDING for a long time without action
 * Either case raises a suspicious-behavior review alert (PointReviewRequest)
 * so it shows up in the admin's active review queue instead of silently
 * expiring.
 */
export async function processComplaints() {
  const pending = await prisma.complaint.findMany({
    where: { status: "PENDING" },
    select: { id: true, reportedUserId: true, createdAt: true },
  });

  if (pending.length === 0) {
    logger.info("[complaints.job] No pending complaints to evaluate.");
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_AFTER_DAYS);

  const countsByUser = pending.reduce((acc, c) => {
    acc[c.reportedUserId] = (acc[c.reportedUserId] || 0) + 1;
    return acc;
  }, {});

  const usersToFlag = new Set();

  for (const [userId, count] of Object.entries(countsByUser)) {
    if (count >= SUSPICIOUS_COMPLAINT_THRESHOLD) usersToFlag.add(userId);
  }

  for (const complaint of pending) {
    if (complaint.createdAt < cutoff) usersToFlag.add(complaint.reportedUserId);
  }

  let flagged = 0;

  for (const userId of usersToFlag) {
    // Don't spam the queue — skip if this user already has an open alert.
    const alreadyFlagged = await prisma.pointReviewRequest.findFirst({
      where: { userId, resolved: false, reason: { startsWith: "SUSPICIOUS_BEHAVIOR" } },
    });
    if (alreadyFlagged) continue;

    await prisma.pointReviewRequest.create({
      data: {
        userId,
        reason:
          `SUSPICIOUS_BEHAVIOR: ${countsByUser[userId] ?? 0} pending complaint(s) against this user, ` +
          `and/or a complaint pending review for over ${STALE_AFTER_DAYS} days. Needs admin review.`,
        resolved: false,
      },
    });
    flagged++;
  }

  logger.info(`[complaints.job] Flagged ${flagged} user(s) for suspicious-behavior review.`);
}
