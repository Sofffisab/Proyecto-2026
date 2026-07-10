import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { POINTS, COMPLAINT_PENALTY } from "../constants/points.js";
import { createNotification } from "./communication.service.js";
import { logger } from "../utils/logger.js";

// Given the count of APPROVED complaints a user has (including the one
// currently being approved), returns the penalty to apply for *this*
// approval. Returns 0 for the free strikes; otherwise grows by STEP for
// every complaint past the free threshold, capped at MAX_PENALTY.
function calculateComplaintPenalty(approvedCount) {
  const strikesPastFree = approvedCount - COMPLAINT_PENALTY.FREE_STRIKES;
  if (strikesPastFree <= 0) return 0;

  const penalty = Math.min(strikesPastFree * COMPLAINT_PENALTY.STEP, COMPLAINT_PENALTY.MAX_PENALTY);
  return -penalty;
}

export async function createComplaint(data) {
  if (data.reporterId === data.reportedUserId) {
    throw new Error("Cannot report yourself");
  }

  const reportedUser = await prisma.user.findUnique({
    where: { id: data.reportedUserId },
  });

  if (!reportedUser) {
    throw new Error("Reported user not found");
  }

  return prisma.complaint.create({
    data: {
      reporterId: data.reporterId,
      reportedUserId: data.reportedUserId,
      reason: data.reason,
      message: data.message,
      status: "PENDING",
    },
  });
}

// Auto-generated complaint from the rate-trainer popup when the member
// marks "No me ayudaron". One per (user, trainer, session) — if it already
// exists (e.g. duplicate submit), just return the existing one instead of
// throwing, since this path is triggered by the UI, not typed in by hand.
export async function createAutoNoHelpComplaint({ reporterId, reportedUserId, gymSessionId, comment }) {
  if (reporterId === reportedUserId) {
    throw new Error("Cannot report yourself");
  }

  const existing = await prisma.complaint.findFirst({
    where: {
      reporterId,
      reportedUserId,
      gymSessionId: gymSessionId ?? null,
      source: "AUTO_NO_HELP",
    },
  });
  if (existing) return existing;

  const reportedUser = await prisma.user.findUnique({ where: { id: reportedUserId } });
  if (!reportedUser) {
    throw new Error("Reported user not found");
  }

  return prisma.complaint.create({
    data: {
      reporterId,
      reportedUserId,
      gymSessionId: gymSessionId ?? null,
      reason: "El entrenador no brindó la ayuda solicitada",
      message: comment ?? null,
      status: "PENDING",
      source: "AUTO_NO_HELP",
    },
  });
}

// Auto-generated when a MachineConflict ("2 personas en la misma máquina")
// times out without a trainer verifying who was actually there — see
// machineConflict.service.js#expireUnverifiedConflicts. One per (reporter,
// reported, conflict) so re-running the expiry job is safe.
export async function createAutoMachineConflictComplaint({ reporterId, reportedUserId, conflictId }) {
  const existing = await prisma.complaint.findFirst({
    where: {
      reporterId,
      reportedUserId,
      source: "AUTO_MACHINE_CONFLICT",
      message: conflictId,
    },
  });
  if (existing) return existing;

  return prisma.complaint.create({
    data: {
      reporterId,
      reportedUserId,
      reason: "Uso simultáneo de la misma máquina sin verificación de un entrenador",
      message: conflictId,
      status: "PENDING",
      source: "AUTO_MACHINE_CONFLICT",
    },
  });
}

// Trainer/Admin reporting a member (e.g. broke a machine, misbehaved).
// Reported user must be a regular member — trainers report members here,
// not other staff.
export async function createTrainerComplaint({ reporterId, reportedUserId, reason, message }) {
  if (reporterId === reportedUserId) {
    throw new Error("Cannot report yourself");
  }

  const reportedUser = await prisma.user.findUnique({ where: { id: reportedUserId } });
  if (!reportedUser) {
    throw new Error("Reported user not found");
  }
  if (reportedUser.role !== "USER") {
    throw new Error("Trainers can only report regular members through this endpoint");
  }

  return prisma.complaint.create({
    data: {
      reporterId,
      reportedUserId,
      reason,
      message: message ?? null,
      status: "PENDING",
      source: "TRAINER_REPORT",
    },
  });
}

export async function getUserComplaints(userId) {
  return prisma.complaint.findMany({
    where: { reporterId: userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getComplaintById(id) {
  return prisma.complaint.findUnique({ where: { id } });
}

export async function getComplaints() {
  return prisma.complaint.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function approveComplaint(id, reviewerId) {
  const complaint = await prisma.complaint.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });

  // Progressive penalty: count how many complaints against this user are
  // now APPROVED (this one included, since we just updated it above).
  const approvedCount = await prisma.complaint.count({
    where: { reportedUserId: complaint.reportedUserId, status: "APPROVED" },
  });

  const penalty = calculateComplaintPenalty(approvedCount);

  if (penalty === 0) {
    // Strikes #1 and #2: evaluated, but no points deducted yet.
    await createNotification(
      complaint.reportedUserId,
      "Complaint reviewed",
      "A complaint against you was approved. No points were deducted this time, " +
        "but further approved complaints will start reducing your points."
    );
  } else {
    await addPoints(
      complaint.reportedUserId,
      penalty,
      `Complaint approved against user (strike #${approvedCount})`
    );

    await createNotification(
      complaint.reportedUserId,
      "Penalty applied",
      `A complaint against you was approved. ${Math.abs(penalty)} points have been deducted from your account.`
    );
  }

  // Too many approved complaints against the same user: raise an admin
  // review alert instead of letting the penalty grow forever unnoticed.
  if (approvedCount >= COMPLAINT_PENALTY.ALERT_THRESHOLD) {
    const alreadyFlagged = await prisma.pointReviewRequest.findFirst({
      where: {
        userId: complaint.reportedUserId,
        resolved: false,
        reason: { startsWith: "REPEAT_COMPLAINTS" },
      },
    });

    if (!alreadyFlagged) {
      try {
        await prisma.pointReviewRequest.create({
          data: {
            userId: complaint.reportedUserId,
            reason:
              `REPEAT_COMPLAINTS: user has ${approvedCount} approved complaints against them ` +
              `(threshold: ${COMPLAINT_PENALTY.ALERT_THRESHOLD}). Needs admin review.`,
            resolved: false,
          },
        });
      } catch (err) {
        logger.error("[complaint.service] Failed to create review-request alert:", err.message);
      }
    }
  }

  return complaint;
}

export async function rejectComplaint(id, reviewerId) {
  return prisma.complaint.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });
}
