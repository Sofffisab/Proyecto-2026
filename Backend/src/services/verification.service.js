import prisma from "../config/prisma.js";
import QRCode from "qrcode";
import crypto from "crypto";
import { completeChallengeByQR } from "./challenge.service.js";
import { POINTS } from "../constants/points.js";
import { addPoints } from "./gamification.service.js";

export async function getUserQR(userId) {
  const payload = JSON.stringify({ userId, type: "USER", ts: Date.now() });
  const qrDataUrl = await QRCode.toDataURL(payload);
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
    return { success: true, message: `Machine ${machine.name} scan registered` };
  }

  if (type === "ENTRY_EXIT") {
    return { success: true, message: "Entry/exit processed by gym service" };
  }

  throw new Error(`Unknown QR type: ${type}`);
}