import * as assistanceService from "../services/assistance.service.js";

export async function request(req, res, next) {
  try {
    const result = await assistanceService.requestAssistance(
      req.user.id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function pending(req, res, next) {
  try {
    const data = await assistanceService.getPendingAssistance();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function assign(req, res, next) {
  try {
    const result = await assistanceService.assignAssistance(
      req.params.id,
      req.body.trainerId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function complete(req, res, next) {
  try {
    const result = await assistanceService.completeAssistance(
      req.params.id
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function history(req, res, next) {
  try {
    const data = await assistanceService.getAssistanceHistory(
      req.user.id
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}