import * as qrService from "../services/qr.service.js";

export async function scan(req, res, next) {
  try {
    const result = await qrService.scan(req.user, req.body);

    if (!result.valid) {
      return res.status(400).json({
        message: "Invalid transaction",
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const qr = await qrService.getUserQR(req.user.id);
    res.json(qr);
  } catch (err) {
    next(err);
  }
}

export async function createMachineQR(req, res, next) {
  try {
    const qr = await qrService.createMachineQR(req.body);
    res.json(qr);
  } catch (err) {
    next(err);
  }
}

export async function regenerateMachineQR(req, res, next) {
  try {
    const qr = await qrService.regenerateMachineQR(req.params.id);
    res.json(qr);
  } catch (err) {
    next(err);
  }
}