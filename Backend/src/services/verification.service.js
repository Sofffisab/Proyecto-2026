import prisma from "../config/prisma.js";
import crypto from "crypto";
import { completeChallengeByQR } from "./challenge.service.js";
import { POINTS } from "../constants/points.js";
import { addPoints, checkAndUnlockAchievements } from "./gamification.service.js";
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

// How long a just-replaced token is still honored after rotation, to cover
// a scan that happened (or was synced from offline storage) while it was
// still the current token. Configurable, defaults to 15 minutes.
const QR_GRACE_WINDOW_MS = parseInt(process.env.MACHINE_QR_GRACE_WINDOW_MS ?? "900000", 10);

export async function regenerateMachineQR(machineId) {
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine) throw new Error("Machine not found");

  const token = crypto.randomBytes(16).toString("hex");
  const now = new Date();

  await prisma.machine.update({
    where: { id: machineId },
    data: {
      qrToken: token,
      qrTokenUpdatedAt: now,
      // Keep the outgoing token valid for a short grace window instead of
      // invalidating it the instant rotation happens.
      previousQrToken: machine.qrToken,
      previousQrTokenValidUntil: new Date(now.getTime() + QR_GRACE_WINDOW_MS),
    },
  });

  return { machineId, token };
}

/**
 * Daily rotation: every active machine QR (and the machine QRs only —
 * entry/exit is a signed, per-request dynamic payload and doesn't need
 * rotation) gets a brand new token. Runs from the noon cron job, but is
 * idempotent-safe to call more than once a day (it just rotates again).
 */
export async function regenerateAllMachineQRCodes() {
  const machines = await prisma.machine.findMany({
    where: { active: true },
    select: { id: true, qrToken: true },
  });

  const now = new Date();
  const validUntil = new Date(now.getTime() + QR_GRACE_WINDOW_MS);

  let count = 0;
  for (const machine of machines) {
    await prisma.machine.update({
      where: { id: machine.id },
      data: {
        qrToken: crypto.randomBytes(16).toString("hex"),
        qrTokenUpdatedAt: now,
        previousQrToken: machine.qrToken,
        previousQrTokenValidUntil: validUntil,
      },
    });
    count++;
  }

  return { regenerated: count };
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
      if (!machine) throw new Error("Invalid machine token");

      const isCurrentToken = machine.qrToken === qrToken;

      // Grace window: a scan against the token that was replaced by the
      // most recent rotation still counts, as long as we're within the
      // window recorded at rotation time. Covers a scan performed (or
      // synced late from offline storage) while that token was still the
      // one posted on the machine — it was valid "at the time", even if
      // rotation has since moved on.
      const isRecentlyExpiredToken =
        machine.previousQrToken != null &&
        machine.previousQrToken === qrToken &&
        machine.previousQrTokenValidUntil != null &&
        new Date() <= new Date(machine.previousQrTokenValidUntil);

      if (!isCurrentToken && !isRecentlyExpiredToken) {
        throw new Error("Invalid machine token");
      }
    }

    // "No usar la app para máquinas": the user only wants entry/exit
    // scanned. Don't create/update any MachineUsage record — the scan is
    // accepted (so a stray tap doesn't error out) but nothing machine-level
    // is stored. Presence is still reaffirmed so a pending auto-checkout is
    // cancelled, same as a normal machine scan would do.
    const scannerSettings = await prisma.userSettings.findUnique({
      where: { userId: scannerId },
      select: { machineTrackingOptOut: true },
    });

    if (scannerSettings?.machineTrackingOptOut) {
      await reopenSessionIfAutoClosed(scannerId).catch(() => {});
      return {
        success: true,
        tracked: false,
        message: "Machine tracking is disabled for this user by preference",
      };
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
        await checkAndUnlockAchievements(scannerId);
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

    let activeSession = await prisma.gymSession.findFirst({
      where: { userId: scannerId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    // "Si no escanea entrada pero sí máquina, marca ese escaneo como
    // máquina Y entrada": a machine scan that starts a new usage implies
    // the user is physically in the gym right now, so if they never
    // scanned/checked in, open a gym session for them here instead of
    // leaving the machine usage orphaned (gymSessionId: null).
    let sessionOpenedByMachineScan = false;
    if (!activeSession) {
      activeSession = await gymCheckIn(scannerId);
      sessionOpenedByMachineScan = true;
    }

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

    const shaped = shapeMachineUsage(created);
    if (sessionOpenedByMachineScan) {
      shaped.gymSessionOpened = true;
      shaped.gymSession = activeSession;
    }
    return shaped;
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
