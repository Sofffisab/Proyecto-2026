import prisma from "../config/prisma.js";

export async function createComplaint(data) {
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

export async function getComplaints() {
  return prisma.complaint.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function approveComplaint(id, reviewerId) {
  return prisma.complaint.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    },
  });
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