import * as complaintService from "../services/complaint.service.js";
import { AppError } from "../utils/errors.js";

// POST /complaints
export async function createComplaint(req, res, next) {
  try {
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

// POST /complaints/trainer  (TRAINER, ADMIN)
// Lets a trainer report a member directly from their interface
// (e.g. broke a machine, misbehaved), instead of only member-to-member reports.
export async function createTrainerComplaint(req, res, next) {
  try {
    const { reportedUserId, reason, message } = req.validatedData;
    const data = await complaintService.createTrainerComplaint({
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

// GET /complaints/me
export async function getMyComplaints(req, res, next) {
  try {
    const data = await complaintService.getUserComplaints(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /complaints  (ADMIN)
export async function getAdminComplaints(req, res, next) {
  try {
    const data = await complaintService.getComplaints();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /complaints/:id  (reporter or ADMIN)
// Detalle de una denuncia puntual (ej. al hacer click en una fila de ReviewReportsScreen,
// o el propio reportante viendo el estado de lo que denunció).
export async function getById(req, res, next) {
  try {
    const complaint = await complaintService.getComplaintById(req.params.id);
    if (!complaint) {
      throw new AppError("Denuncia no encontrada", 404);
    }
    const isOwner = complaint.reporterId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      throw new AppError("No autorizado para ver esta denuncia", 403);
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