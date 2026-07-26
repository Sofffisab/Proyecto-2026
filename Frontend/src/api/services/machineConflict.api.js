// src/api/services/machineConflict.api.js
//
// Maps to Backend/src/routes/index.js "QR MANAGEMENT ROUTES" (machine
// conflicts section) and Backend/src/controllers/machineConflict.controller.js.
// Trainer/Admin-facing verification queue for two people scanning the same
// machine at (roughly) the same time — see
// Backend/src/services/machineConflict.service.js#flagMachineConflict.

import { apiClient } from '../client';

// GET /qr/machine-conflicts — TRAINER/ADMIN only. Conflicts still awaiting
// in-person verification (resolvedAt === null), oldest first, each already
// including the machine and both users involved
// (machineConflict.service.js#getPendingConflicts).
export function getPendingConflicts() {
  return apiClient.get('/qr/machine-conflicts');
}

// PATCH /qr/machine-conflicts/:id/resolve — TRAINER/ADMIN only. Body
// validated against
// Backend/src/validators/progress.schemas.js#resolveMachineConflictSchema:
// { resolution: 'BOTH_PRESENT' | 'NEITHER_PRESENT' | 'ONLY_FIRST' | 'ONLY_SECOND' }.
// The trainer verifies in person who is actually on the machine; whoever
// wasn't there has their machine usage closed server-side
// (machineConflict.service.js#resolveConflict).
export function resolveConflict(conflictId, resolution) {
  return apiClient.patch(`/qr/machine-conflicts/${conflictId}/resolve`, { resolution });
}
