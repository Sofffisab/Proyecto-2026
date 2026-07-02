import prisma from "../config/prisma.js";
import QRCode from "qrcode";
import crypto from "crypto";
import { completeChallengeByQR } from "./challenge.service.js";
import { POINTS } from "../constants/points.js";
import { addPoints } from "./gamification.service.js";

// QR tokens expire after this many milliseconds (default: 5 minutes)
const QR_TTL_MS = parseInt(process.env.USER_QR_TTL_MS ?? "300000", 10);

/**
 * Signs a payload object with HMAC-SHA256 using the server secret.
 * Returns the hex signature.
 */
function signQRPayload(payloadStr) {
  const secret = process.env.QR_HMAC_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("QR_HMAC_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
}

/**
 * Bug 14: generates a user QR with an HMAC signature so the payload
 * cannot be forged by anyone who only knows a user UUID.
 * Bug 15: includes a timestamp that is verified on scan to enforce TTL.
 */
export async function getUserQR(userId) {
  const ts = Date.now();
  const payloadStr = JSON.stringify({ userId, type: "USER", ts });
  const sig = signQRPayload(payloadStr);
  const signed = JSON.stringify({ userId, type: "USER", ts, sig });
  const qrDataUrl = await QRCode.toDataURL(signed);
  return { userId, qrDataUrl };
}

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

export function validateQRPayload(rawPayload) {
  try {
    const parsed = JSON.parse(rawPayload);
    if (!parsed.type) return { valid: false };

    // Validate HMAC signature and TTL only for USER QR codes (Bug 14 & 15)
    if (parsed.type === "USER") {
      const { sig, ...rest } = parsed;

      // Verify signature
      const expectedSig = signQRPayload(JSON.stringify(rest));
      if (!sig || sig !== expectedSig) {
        return { valid: false, reason: "Invalid QR signature" };
      }

      // Verify TTL
      if (!rest.ts || Date.now() - rest.ts > QR_TTL_MS) {
        return { valid: false, reason: "QR code has expired" };
      }
    }

    return { valid: true, type: parsed.type, data: parsed };
  } catch {
    return { valid: false };
  }
}

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

    if (!challenge) {
      throw new Error("No active accepted challenge between these users");
    }

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

    // Symmetric scan-to-start / scan-again-to-end: check for an existing
    // open usage of this machine by this user before opening a new one,
    // mirroring the check-in/check-out pattern used for GymSession and
    // the offline "machineEnd" sync action.
    const openUsage = await prisma.machineUsage.findFirst({
      where: { userId: scannerId, machineId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (openUsage) {
      const endedAt = new Date();
      const durationMinutes = Math.floor(
        (endedAt - new Date(openUsage.startedAt)) / (1000 * 60)
      );

      await prisma.machineUsage.update({
        where: { id: openUsage.id },
        data: { endedAt, durationMinutes },
      });

      await addPoints(scannerId, POINTS.MACHINE_USAGE, `Machine used: ${machine.name}`);
      return { success: true, message: `Machine ${machine.name} usage ended`, ended: true };
    }

    // gymSessionId is optional — the user may not have an active session
    const activeSession = await prisma.gymSession.findFirst({
      where: { userId: scannerId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    await prisma.machineUsage.create({
      data: {
        userId: scannerId,
        machineId,
        gymSessionId: activeSession?.id ?? null,
        startedAt: new Date(),
      },
    });

    await addPoints(scannerId, POINTS.MACHINE_USAGE, `Machine used: ${machine.name}`);
    return { success: true, message: `Machine ${machine.name} scan registered`, ended: false };
  }

  if (type === "ENTRY_EXIT") {
    return { success: true, message: "Entry/exit processed by gym service" };
  }

  throw new Error(`Unknown QR type: ${type}`);
}