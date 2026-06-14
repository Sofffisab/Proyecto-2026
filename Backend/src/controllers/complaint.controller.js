import * as complaintService from "../services/complaint.service.js";

export async function create(req, res, next) {
  try {
    const data = await complaintService.createComplaint(
      req.body
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAll(req, res, next) {
  try {
    const data = await complaintService.getComplaints();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function approve(req, res, next) {
  try {
    const data = await complaintService.approveComplaint(
      req.params.id,
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function reject(req, res, next) {
  try {
    const data = await complaintService.rejectComplaint(
      req.params.id,
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}