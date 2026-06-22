import * as complaintService from "../services/complaint.service.js";

export async function create(req, res, next) {
  try {
    // SECURITY: reporterId is always taken from the authenticated session —
    // never from req.body. Previously `...req.body` spread allowed a caller
    // to supply their own reporterId and impersonate another user.
    // req.validatedData comes from createComplaintSchema which only exposes
    // { reportedUserId, reason, message }, so no extra fields can leak through.
    const { reportedUserId, reason, message } = req.validatedData;
    const data = await complaintService.createComplaint({
      reporterId: req.user.id,
      reportedUserId,
      reason,
      message,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMine(req, res, next) {
  try {
    const data = await complaintService.getUserComplaints(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAll(req, res, next) {
  try {
    const data = await complaintService.getComplaints();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const complaint = await complaintService.getComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    if (req.user.role !== "ADMIN" && complaint.reporterId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    res.json({ success: true, data: complaint });
  } catch (err) {
    next(err);
  }
}

export async function resolveComplaint(req, res, next) {
  try {
    const data = await complaintService.approveComplaint(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function rejectComplaint(req, res, next) {
  try {
    const data = await complaintService.rejectComplaint(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}