import prisma from "../config/prisma.js";
import { logger } from "../utils/logger.js";

const STALE_AFTER_DAYS = 30;
// This many PENDING complaints against one user flags a suspicious pattern
const SUSPICIOUS_COMPLAINT_THRESHOLD = 3;

/**
 * Never auto-approves/rejects complaints — only flags patterns for admin
 * review: many pending complaints on one user, or one stale too long.
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
