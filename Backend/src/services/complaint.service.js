import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";
import { createNotification } from "./communication.service.js";

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

  // Deduct points from the reported user.
  // Force the value to be negative regardless of how the constant is configured,
  // so a misconfigured positive value can never accidentally award points.
  const penalty = -Math.abs(POINTS.APPROVED_COMPLAINT_PENALTY);
  await addPoints(
    complaint.reportedUserId,
    penalty,
    "Complaint approved against user"
  );

  // Notify the reported user that points were deducted
  await createNotification(
    complaint.reportedUserId,
    "Penalty applied",
    `A complaint against you was approved. ${Math.abs(penalty)} points have been deducted from your account.`
  );

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
