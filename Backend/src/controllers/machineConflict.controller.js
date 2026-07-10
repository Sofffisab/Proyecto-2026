import * as machineConflictService from "../services/machineConflict.service.js";

// Trainer-facing: list conflicts still awaiting in-person verification.
export async function getPendingConflicts(req, res, next) {
  try {
    const conflicts = await machineConflictService.getPendingConflicts();
    res.json({ success: true, data: conflicts });
  } catch (err) {
    next(err);
  }
}

// Trainer verifies who is actually on the machine.
export async function resolveConflict(req, res, next) {
  try {
    const { resolution } = req.validatedData;
    const conflict = await machineConflictService.resolveConflict(
      req.params.id,
      req.user.id,
      resolution
    );
    res.json({ success: true, data: conflict });
  } catch (err) {
    next(err);
  }
}
