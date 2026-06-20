import * as assistanceService from "../services/assistance.service.js";
import prisma from "../config/prisma.js";

export async function requestAssistance(req, res, next) {
  try {
    const result = await assistanceService.requestAssistance(req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// Trainer/Admin: list all pending requests
export async function getAssistanceRequests(req, res, next) {
  try {
    const data = await assistanceService.getPendingAssistance();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// User: list their own requests
export async function getUserAssistanceRequests(req, res, next) {
  try {
    const data = await assistanceService.getAssistanceHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function assignAssistance(req, res, next) {
  try {
    const result = await assistanceService.assignAssistance(
      req.params.id,
      req.body.trainerId
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function completeAssistance(req, res, next) {
  try {
    const result = await assistanceService.completeAssistance(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function cancelAssistance(req, res, next) {
  try {
    const assistance = await prisma.assistance.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!assistance) {
      return res
        .status(404)
        .json({ success: false, message: "Assistance request not found" });
    }

    if (assistance.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a request with status: ${assistance.status}`,
      });
    }

    const updated = await prisma.assistance.update({
      where: { id: req.params.id },
      data: { status: "EXPIRED" },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}