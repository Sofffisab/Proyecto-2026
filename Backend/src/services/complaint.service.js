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