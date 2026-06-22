import * as assistanceService from "../services/assistance.service.js";

export async function requestAssistance(req, res, next) {
  try {
    const result = await assistanceService.requestAssistance(req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getAssistanceRequests(req, res, next) {
  try {
    const data = await assistanceService.getPendingAssistance();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

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
    // Force trainerId to the authenticated trainer's own ID.
    // A trainer cannot assign an assistance request to another trainer.
    const result = await assistanceService.assignAssistance(
      req.params.id,
      req.user.id
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
    const result = await assistanceService.cancelAssistance(
      req.params.id,
      req.user.id
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}