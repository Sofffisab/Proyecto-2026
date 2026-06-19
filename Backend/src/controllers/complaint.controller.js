import * as complaintService from '../services/complaint.service.js';
import prisma from '../config/prisma.js';

export async function createComplaint(req, res, next) {
  try {
    const data = await complaintService.createComplaint(req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function getUserComplaints(req, res, next) {
  try {
    const data = await complaintService.getComplaints({ reporterId: req.user.id });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getAllComplaints(req, res, next) {
  try {
    const data = await complaintService.getComplaints();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getComplaintById(req, res, next) {
  try {
    const data = await prisma.complaint.findUnique({
      where: { id: req.params.id },
    });
    if (!data) return res.status(404).json({ message: 'Complaint not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function resolveComplaint(req, res, next) {
  try {
    const data = await complaintService.approveComplaint(req.params.id, req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function rejectComplaint(req, res, next) {
  try {
    const data = await complaintService.rejectComplaint(req.params.id, req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}