import prisma from "../config/prisma.js";
import crypto from "crypto";
import { completeChallengeByQR } from "./challenge.service.js";
import { POINTS } from "../constants/points.js";
import { addPoints } from "./gamification.service.js";
import { checkIn as gymCheckIn, checkOut as gymCheckOut, reopenSessionIfAutoClosed } from "./gym.service.js";

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
 * Generates a signed USER QR payload (HMAC-SHA256), including a timestamp
 * that is verified on scan to enforce a TTL. Synchronous — callers that need
 * an actual scannable image should encode the returned payload themselves.
 */
export function getUserQR(userId) {
  const ts = Date.now();
  const payload = { userId, type: "USER", ts };
  const signature = signQRPayload(JSON.stringify(payload));
  return { ...payload, signature };
}

export async function regenerateMachineQR(machineId) {
  const token = crypto.randomBytes(16).toString("hex");

  await prisma.machine.update({
    where: { id: machineId },
    data: { qrToken: token, qrTokenUpdatedAt: new Date() },
  });

  return { machineId, token };
}

/**
 * Validates a QR payload (object, or a JSON string that will be parsed).
 * Throws on any invalid payload rather than returning a { valid } flag.
 * Only USER-type payloads require an HMAC signature + TTL check.
 */
export function validateQRPayload(rawPayload) {
  let parsed = rawPayload;
  if (typeof rawPayload === "string") {
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      throw new Error("Invalid QR payload");
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid QR payload");
  }

  if (!parsed.type) {
    throw new Error("QR payload is missing a type");
  }

  if (parsed.type === "USER") {
    const { signature, ...rest } = parsed;
    const expectedSignature = signQRPayload(JSON.stringify(rest));

    if (!signature || signature !== expectedSignature) {
      throw new Error("Invalid signature");
    }

    if (!rest.ts || Date.now() - rest.ts > QR_TTL_MS) {
      throw new Error("QR expired");
    }
  }

  return parsed;
}

function shapeMachineUsage(usage) {
  const shaped = {
    id: usage.id,
    machineId: usage.machineId,
    startedAt: usage.startedAt,
  };
  if (usage.endedAt) shaped.endedAt = usage.endedAt;
  if (usage.durationMinutes != null) shaped.durationMinutes = usage.durationMinutes;
  if (usage.gymSessionId != null) shaped.gymSessionId = usage.gymSessionId;
  return shaped;
}

export async function processScan(scannerId, rawPayload) {
  const data = validateQRPayload(rawPayload);
  const { type } = data;

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
      throw new Error("No active challenge between these users");
    }

    await completeChallengeByQR(challenge.id, scannerId, targetId);
    return { success: true, message: "Challenge completed via QR scan" };
  }

  if (type === "MACHINE") {
    const { machineId, qrToken } = data;
    if (!machineId) throw new Error("Missing machineId in QR payload");

    if (qrToken) {
      const machine = await prisma.machine.findUnique({ where: { id: machineId } });
      if (!machine || machine.qrToken !== qrToken) {
        throw new Error("Invalid machine token");
      }
    }

    // Any machine scan proves the user is still physically in the gym —
    // cancel a pending auto-checkout if one was scheduled/applied.
    await reopenSessionIfAutoClosed(scannerId).catch(() => {});

    const openUsage = await prisma.machineUsage.findFirst({
      where: { userId: scannerId, machineId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (openUsage) {
      const endedAt = new Date();
      const durationMinutes = Math.max(
        1,
        Math.floor((endedAt - new Date(openUsage.startedAt)) / (1000 * 60))
      );

      const updated = await prisma.machineUsage.update({
        where: { id: openUsage.id },
        data: { endedAt, durationMinutes },
      });

      try {
        await addPoints(scannerId, POINTS.MACHINE_USAGE, "Machine usage ended");
      } catch {
        // Points/achievements are best-effort; never block the scan flow.
      }

      return shapeMachineUsage(updated);
    }

    // Scanning a *different* machine without ending the previous one used to
    // leave that MachineUsage open forever. Close it out first so every
    // usage record is properly bounded.
    const otherOpenUsage = await prisma.machineUsage.findFirst({
      where: { userId: scannerId, endedAt: null, machineId: { not: machineId } },
      orderBy: { startedAt: "desc" },
    });

    if (otherOpenUsage) {
      const endedAt = new Date();
      const durationMinutes = Math.max(
        1,
        Math.floor((endedAt - new Date(otherOpenUsage.startedAt)) / (1000 * 60))
      );
      await prisma.machineUsage.update({
        where: { id: otherOpenUsage.id },
        data: { endedAt, durationMinutes },
      });
    }

    const activeSession = await prisma.gymSession.findFirst({
      where: { userId: scannerId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    const created = await prisma.machineUsage.create({
      data: {
        userId: scannerId,
        machineId,
        gymSessionId: activeSession?.id ?? null,
        startedAt: new Date(),
      },
    });

    try {
      await addPoints(scannerId, POINTS.MACHINE_USAGE, "Machine usage started");
    } catch {
      // Points/achievements are best-effort; never block the scan flow.
    }

    return shapeMachineUsage(created);
  }

  if (type === "ENTRY_EXIT") {
    const openSession = await prisma.gymSession.findFirst({
      where: { userId: scannerId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    if (openSession) {
      const session = await gymCheckOut(scannerId);
      return { action: "CHECK_OUT", session };
    }

    const session = await gymCheckIn(scannerId);
    return { action: "CHECK_IN", session };
  }

  throw new Error(`Unknown QR type: ${type}`);
}
