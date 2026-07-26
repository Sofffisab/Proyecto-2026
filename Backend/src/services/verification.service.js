import { prisma } from "../config/index.js";
import crypto from "crypto";
import { completeChallengeByQR, rejectChallenge } from "./challenge.service.js";
import { userHasActiveChallenge } from "./history.service.js";
import { MACHINE_USAGE_DURATION_TIERS } from "../constants/points.js";
import { addPoints, checkAndUnlockAchievements } from "./gamification.service.js";
import { checkIn as gymCheckIn, checkOut as gymCheckOut, reopenSessionIfAutoClosed } from "./gym.service.js";
import { flagMachineConflict } from "./machineConflict.service.js";
import { logger } from "../utils/logger.js";

// QR tokens expire after this many milliseconds (default: 5 minutes)
const QR_TTL_MS = parseInt(process.env.USER_QR_TTL_MS ?? "300000", 10);

// Minimum real minutes a machine usage must last to earn points
const MIN_MACHINE_USAGE_MINUTES_FOR_POINTS = parseInt(
  process.env.MIN_MACHINE_USAGE_MINUTES_FOR_POINTS ?? "3",
  10
);

/** Signs a payload with HMAC-SHA256 using the server secret; returns hex signature. */
function signQRPayload(payloadStr) {
  const secret = process.env.QR_HMAC_SECRET ?? process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("QR_HMAC_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");
}

/** Generates a signed, timestamped USER QR payload (TTL enforced on scan). */
export function getUserQR(userId) {
  const ts = Date.now();
  const payload = { userId, type: "USER", ts };
  const signature = signQRPayload(JSON.stringify(payload));
  return { ...payload, signature };
}

// Grace period a just-replaced QR token is still honored after rotation
// (covers scans synced late from offline storage)
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
      // Keep the previous token valid for a short grace window
      previousQrToken: machine.qrToken,
      previousQrTokenValidUntil: new Date(now.getTime() + QR_GRACE_WINDOW_MS),
    },
  });

  return { machineId, token };
}

/** Daily rotation of all active machine QR tokens (entry/exit QRs don't need this). Safe to call more than once a day. */
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

/** Validates a QR payload (object or JSON string), throwing on any invalid case. Only USER-type payloads need a signature + TTL check. */
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

// Points for the first duration tier reached (0 if under the shortest tier).
export function computeMachineUsagePoints(durationMinutes) {
  for (const tier of MACHINE_USAGE_DURATION_TIERS) {
    if (durationMinutes >= tier.minMinutes) return tier.points;
  }
  return 0;
}

/**
 * Ends a user's currently-open MachineUsage, awarding duration-weighted
 * points if it cleared the minimum training time. Never throws.
 */
export async function closeOpenMachineUsage(userId, reason = "Machine usage ended") {
  const openUsage = await prisma.machineUsage.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (!openUsage) return null;

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
    if (durationMinutes >= MIN_MACHINE_USAGE_MINUTES_FOR_POINTS) {
      const points = computeMachineUsagePoints(durationMinutes);
      if (points > 0) {
        await addPoints(userId, points, reason);
      }
    }
    await checkAndUnlockAchievements(userId);
  } catch (err) {
    // Best-effort only; never block the checkout/scan flow
    logger.error("[verification] Failed to award points on machine-usage close:", err.message);
  }

  return updated;
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

// Prompts an opted-out user to re-enable tracking if they scan anyway.
function withOptOutPrompt(result, machineTrackingOptedOut) {
  if (!machineTrackingOptedOut) return result;
  return {
    ...result,
    tracked: true,
    askDisableMachineTrackingOptOut: true,
    message:
      "This scan was registered even though machine tracking is off in your preferences. Want to turn it back on?",
  };
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

      // Grace window: a scan against the just-rotated-out token still counts
      // (covers scans synced late from offline storage)
      const isRecentlyExpiredToken =
        machine.previousQrToken != null &&
        machine.previousQrToken === qrToken &&
        machine.previousQrTokenValidUntil != null &&
        new Date() <= new Date(machine.previousQrTokenValidUntil);

      if (!isCurrentToken && !isRecentlyExpiredToken) {
        throw new Error("Invalid machine token");
      }
    }

    // Opt-out only affects unprompted use of machine data (e.g. AI routine
    // suggestions); if the user scans anyway, the scan is still registered
    // and the response is flagged so the app can offer to re-enable tracking.
    const scannerSettings = await prisma.userSettings.findUnique({
      where: { userId: scannerId },
      select: { machineTrackingOptOut: true },
    });

    const machineTrackingOptedOut = Boolean(scannerSettings?.machineTrackingOptOut);

    // A scan proves the user is still present — cancel any pending auto-checkout
    await reopenSessionIfAutoClosed(scannerId).catch(() => {});

    const openUsage = await prisma.machineUsage.findFirst({
      where: { userId: scannerId, machineId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (openUsage) {
      // Duration-weighted points, gated by the minimum-time floor
      const updated = await closeOpenMachineUsage(scannerId, "Machine usage ended");
      return withOptOutPrompt(shapeMachineUsage(updated), machineTrackingOptedOut);
    }

    // Starting a brand-new usage while the user has an active (ACCEPTED)
    // social challenge forfeits it — same effect as manually rejecting:
    // status -> REJECTED and, if applicable, consolation points to the
    // partner (see challenge.service.js#rejectChallenge). Best-effort: a
    // failure here should never block the machine scan itself.
    const pendingChallenge = await userHasActiveChallenge(scannerId);
    if (pendingChallenge) {
      await rejectChallenge(pendingChallenge.id, scannerId).catch((err) =>
        logger.error("[verification] Failed to auto-forfeit social challenge:", err.message)
      );
    }

    // Starting a different machine auto-closes any other open usage
    const otherOpenUsage = await prisma.machineUsage.findFirst({
      where: { userId: scannerId, endedAt: null, machineId: { not: machineId } },
      orderBy: { startedAt: "desc" },
    });

    if (otherOpenUsage) {
      await closeOpenMachineUsage(scannerId, "Machine usage auto-closed (started a different machine)");
    }

    // Another user's usage is still open on this machine — flag as a
    // conflict for a trainer to verify (see machineConflict.service.js)
    const concurrentUsageByOther = await prisma.machineUsage.findFirst({
      where: { machineId, endedAt: null, userId: { not: scannerId } },
      orderBy: { startedAt: "asc" },
    });

    let activeSession = await prisma.gymSession.findFirst({
      where: { userId: scannerId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    // A machine scan with no active gym session implies the user is
    // physically present — open a session so the usage isn't orphaned
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

    // Points are awarded on the "end" scan only, to prevent farming by
    // rapidly hopping between machine start QR codes

    if (concurrentUsageByOther) {
      flagMachineConflict({
        machineId,
        firstUsage: concurrentUsageByOther,
        secondUsage: created,
      }).catch((err) =>
        logger.error("[verification] Failed to flag machine conflict:", err.message)
      );
    }

    const shaped = shapeMachineUsage(created);
    if (concurrentUsageByOther) shaped.suspiciousActivity = true;
    if (sessionOpenedByMachineScan) {
      shaped.gymSessionOpened = true;
      shaped.gymSession = activeSession;
    }
    return withOptOutPrompt(shaped, machineTrackingOptedOut);
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
