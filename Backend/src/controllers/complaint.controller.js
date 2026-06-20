import * as complaintService from "../services/complaint.service.js";
import prisma from "../config/prisma.js";

export async function createComplaint(req, res, next) {
  try {
    // Always use the authenticated user's id — never trust req.body.reporterId
    const data = await complaintService.createComplaint({
      ...req.body,
      reporterId: req.user.id,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUserComplaints(req, res, next) {
  try {
    const data = await prisma.complaint.findMany({
      where: { reporterId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAllComplaints(req, res, next) {
  try {
    const data = await complaintService.getComplaints();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getComplaintById(req, res, next) {
  try {
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
    });
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }
    // Users can only view their own; admins can view all
    if (
      req.user.role !== "ADMIN" &&
      complaint.reporterId !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    res.json({ success: true, data: complaint });
  } catch (err) {
    next(err);
  }
}

export async function resolveComplaint(req, res, next) {
  try {
    const data = await complaintService.approveComplaint(
      req.params.id,
      req.user.id
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function rejectComplaint(req, res, next) {
  try {
    const data = await complaintService.rejectComplaint(
      req.params.id,
      req.user.id
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}