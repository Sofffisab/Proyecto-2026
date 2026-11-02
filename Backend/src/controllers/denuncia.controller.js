import * as denunciaService from "../services/denuncia.service.js";

// GET /gym/sessions/:id/checkout-context
export async function getCheckoutContext(req, res, next) {
  try {
    const data = await denunciaService.getCheckoutContext(req.params.id, req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// POST /gym/sessions/:id/checkout-feedback
export async function submitCheckoutFeedback(req, res, next) {
  try {
    const data = await denunciaService.submitCheckoutFeedback(req.params.id, req.user.id, req.validatedData);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /denuncias  (ADMIN)
export async function listDenuncias(req, res, next) {
  try {
    const data = await denunciaService.listDenuncias({
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PATCH /denuncias/:id/status  (ADMIN)
export async function updateDenunciaStatus(req, res, next) {
  try {
    const data = await denunciaService.updateDenunciaStatus(req.params.id, req.validatedData.status);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
