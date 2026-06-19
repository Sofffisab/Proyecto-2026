import prisma from "../config/prisma.js";
import QRCode from "qrcode";
import crypto from "crypto";
import { completeChallengeByQR } from "./challenge.service.js";
import { POINTS } from "../constants/points.js";
import { addPoints } from "./gamification.service.js";

// ============================================
// QR GENERATION
// ============================================

/**
 * Genera el payload QR de un usuario (su ID firmado).
 * El frontend usa esto para renderizar el QR con la librería que prefiera.
 * @param {string} userId
 * @returns {{ userId: string, qrDataUrl: string }}
 */
export async function getUserQR(userId) {
  const payload = JSON.stringify({ userId, type: "USER", ts: Date.now() });
  const qrDataUrl = await QRCode.toDataURL(payload);
  return { userId, qrDataUrl };
}

/**
 * Genera o regenera el QR token de una máquina.
 * @param {string} machineId
 */
export async function regenerateMachineQR(machineId) {
  const token = crypto.randomBytes(16).toString("hex");
  const payload = JSON.stringify({ machineId, type: "MACHINE", token });
  const qrDataUrl = await QRCode.toDataURL(payload);

  await prisma.machine.update({
    where: { id: machineId },
    data: { qrToken: token, qrTokenUpdatedAt: new Date() },
  });

  return { machineId, token, qrDataUrl };
}

// ============================================
// TOKEN VALIDATION
// ============================================

/**
 * Valida un token QR escaneado y devuelve su tipo y payload.
 * @param {string} rawPayload - El string crudo del QR escaneado
 * @returns {{ valid: boolean, type: string, data: object }}
 */
export function validateQRPayload(rawPayload) {
  try {
    const parsed = JSON.parse(rawPayload);
    if (!parsed.type) return { valid: false };
    return { valid: true, type: parsed.type, data: parsed };
  } catch {
    return { valid: false };
  }
}

// ============================================
// SCAN ROUTING
// ============================================

/**
 * Procesa el escaneo de un QR según su tipo.
 * USER   → completa un desafío social activo entre los dos usuarios
 * MACHINE → registra uso de máquina y otorga puntos
 * ENTRY_EXIT → delega al gym.service (check-in / check-out)
 *
 * @param {string} scannerId - Usuario que escanea
 * @param {string} rawPayload - String crudo del QR
 */
export async function processScan(scannerId, rawPayload) {
  const { valid, type, data } = validateQRPayload(rawPayload);

  if (!valid) throw new Error("Invalid QR payload");

  if (type === "USER") {
    const targetId = data.userId;
    if (!targetId) throw new Error("Missing userId in QR payload");

    const challenge = await prisma.socialChallenge.findFirst({
      where: {
        OR: [
          { userId: scannerId, partnerUserId: targetId },
          { userId: targetId, partnerUserId: scannerId },
        ],
        status: "ACCEPTED",
      },
    });

    if (!challenge) throw new Error("No active accepted challenge between these users");

    await completeChallengeByQR(challenge.id, scannerId, targetId);
    return { success: true, message: "Challenge completed via QR scan" };
  }

  if (type === "MACHINE") {
    const machineId = data.machineId;
    if (!machineId) throw new Error("Missing machineId in QR payload");

    const machine = await prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine || machine.qrToken !== data.token) {
      throw new Error("Invalid or expired machine QR");
    }

    // Registrar uso
    await prisma.machineUsage.create({
      data: {
        userId: scannerId,
        machineId,
        startedAt: new Date(),
      },
    });

    await addPoints(scannerId, POINTS.MACHINE_USAGE, `Machine used: ${machine.name}`);
    return { success: true, message: `Machine ${machine.name} scan registered` };
  }

  if (type === "ENTRY_EXIT") {
    // El gym.service (check-in / check-out) maneja este tipo
    return { success: true, message: "Entry/exit processed by gym service" };
  }

  throw new Error(`Unknown QR type: ${type}`);
}