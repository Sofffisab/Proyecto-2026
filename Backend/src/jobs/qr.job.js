import { regenerateAllMachineQRCodes } from "../services/verification.service.js";
import { logger } from "../utils/logger.js";

// Daily noon cron (vercel.json + "/cron/qr-rotate"): rotates every machine's
// QR token so old/photographed posters stop working. Manual per-machine
// rotation is also available via PATCH /qr/machines/:id/regenerate.
export async function rotateMachineQRCodes() {
  const { regenerated } = await regenerateAllMachineQRCodes();
  logger.info(`[qr.job] Rotated QR codes for ${regenerated} active machine(s).`);
}
