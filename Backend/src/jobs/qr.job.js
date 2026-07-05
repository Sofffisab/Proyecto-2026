import { regenerateAllMachineQRCodes } from "../services/verification.service.js";

/**
 * Runs at 12:00 (noon) every day (see vercel.json crons + routes/index.js
 * "/cron/qr-rotate"). Rotates every active machine's QR token so a stale or
 * photographed QR poster stops working the next day. A trainer or admin can
 * still rotate a single machine's QR by hand at any time via
 * PATCH /qr/machines/:id/regenerate — that manual action is independent of
 * this job and simply moves that machine's qrTokenUpdatedAt forward too.
 */
export async function rotateMachineQRCodes() {
  const { regenerated } = await regenerateAllMachineQRCodes();
  console.log(`[qr.job] Rotated QR codes for ${regenerated} active machine(s).`);
}
