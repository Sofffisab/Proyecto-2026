import * as verificationService from "../services/verification.service.js";

export async function scan(req, res, next) {
  try {
    const result = await verificationService.processScan(
      req.user.id,
      req.body.payload
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const qr = await verificationService.getUserQR(req.user.id);
    res.json(qr);
  } catch (err) {
    next(err);
  }
}

export async function regenerateMachineQR(req, res, next) {
  try {
    const qr = await verificationService.regenerateMachineQR(req.params.id);
    res.json(qr);
  } catch (err) {
    next(err);
  }
}