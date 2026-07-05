import * as assistanceService from "../services/assistance.service.js";

export async function request(req, res, next) {
  try {
    const data = await assistanceService.requestAssistance(req.user.id);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function assign(req, res, next) {
  try {
    // req.validatedData from assignAssistanceSchema guarantees trainerId is a valid UUID.
    const { trainerId } = req.validatedData;
    const data = await assistanceService.assignAssistance(req.params.id, trainerId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function complete(req, res, next) {
  try {
    // Pass callerId and callerRole so the service can enforce trainer ownership.
    const data = await assistanceService.completeAssistance(
      req.params.id,
      req.user.id,
      req.user.role
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function cancel(req, res, next) {
  try {
    const data = await assistanceService.cancelAssistance(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function setAvailability(req, res, next) {
  try {
    const { availability } = req.body;
    // ADMIN can only manage their own availability if they also hold a trainer
    // profile; in practice this route is meant for the authenticated trainer.
    const data = await assistanceService.setTrainerAvailability(req.user.id, availability);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPending(req, res, next) {
  try {
    const data = await assistanceService.getPendingAssistance();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req, res, next) {
  try {
    const data = await assistanceService.getAssistanceHistory(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}