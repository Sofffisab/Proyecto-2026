// src/api/services/qrManagement.api.js
//
// Maps 1:1 to Backend/src/routes/index.js "QR MANAGEMENT ROUTES" section and
// Backend/src/controllers/qr.controller.js. This is the Trainer/Admin
// "Generar nuevo QR" surface (spec sections 9 and 13) — separate from
// qr.api.js, which is the member-facing "get my own QR / scan" surface.
//
// IMPORTANT backend reality (verified in Backend/src/services/
// verification.service.js#processScan and Backend/prisma/schema.prisma):
// only MACHINE QRs are persisted, signed-by-token entities that can be
// "regenerated". Entry/exit QRs use payload `{ type: "ENTRY_EXIT" }` with
// no token or signature check at all — there's nothing in the DB to
// rotate for them, so there's no endpoint for it (confirmed: no
// entry/exit QR model, no route). The spec's "elegir si es máquina,
// entrada, salida" is honored as a type selector in the UI, but only the
// Machine path calls a real endpoint — Entry/Exit is explained as
// "nothing to regenerate" rather than faking a network call.

import { apiClient } from '../client';

// GET /qr/gym-access — ADMIN only. Lists every active machine (id, name,
// current qrToken, etc.) so the Admin can pick one to regenerate/deactivate.
export function getGymQRCodes() {
  return apiClient.get('/qr/gym-access');
}

// POST /qr/machines — ADMIN only. Body validated against
// Backend/src/validators/progress.schemas.js#createMachineSchema: { name }.
export function createMachine(name) {
  return apiClient.post('/qr/machines', { name });
}

// PATCH /qr/machines/:id/regenerate — ADMIN or TRAINER. Rotates a single
// machine's QR token immediately (independent from the daily automatic
// rotation cron, see Backend/src/jobs/qr.job.js).
export function regenerateMachine(machineId) {
  return apiClient.patch(`/qr/machines/${machineId}/regenerate`);
}

// DELETE /qr/machines/:id — ADMIN only. Deactivates (never hard-deletes)
// a machine, preserving historical MachineUsage rows.
export function deactivateMachine(machineId) {
  return apiClient.delete(`/qr/machines/${machineId}`);
}
