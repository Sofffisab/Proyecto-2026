import prisma from "../config/prisma.js";
import crypto from "crypto";
import { completeChallengeByQR } from "./challenge.service.js";
import { MACHINE_USAGE_DURATION_TIERS } from "../constants/points.js";
import { addPoints, checkAndUnlockAchievements } from "./gamification.service.js";
import { checkIn as gymCheckIn, checkOut as gymCheckOut, reopenSessionIfAutoClosed } from "./gym.service.js";
import { flagMachineConflict } from "./machineConflict.service.js";
import { logger } from "../utils/logger.js";

// QR tokens expire after this many milliseconds (default: 5 minutes)
const QR_TTL_MS = parseInt(process.env.USER_QR_TTL_MS ?? "300000", 10);

// Minimum real minutes a machine usage must have lasted before it earns
// POINTS.MACHINE_USAGE. Keeps the points economy tied to actual training
// time instead of quick start/end taps.
const MIN_MACHINE_USAGE_MINUTES_FOR_POINTS = parseInt(
  process.env.MIN_MACHINE_USAGE_MINUTES_FOR_POINTS ?? "3",
  10
);

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

// Walks MACHINE_USAGE_DURATION_TIERS (longest minimum first) and returns the
// points for the first tier the duration qualifies for. Falls back to 0 for
// anything under the shortest tier (callers already gate on
// MIN_MACHINE_USAGE_MINUTES_FOR_POINTS before calling this, so in practice
// that floor is never hit here, but it's a safe default regardless).
export function computeMachineUsagePoints(durationMinutes) {
  for (const tier of MACHINE_USAGE_DURATION_TIERS) {
    if (durationMinutes >= tier.minMinutes) return tier.points;
  }
  return 0;
}

/**
 * Ends any currently-open MachineUsage for a user (if any) — used both when
 * a different machine/entry scan implies the previous one is over, and when
 * the user leaves the gym entirely (see gym.service.js#checkOut). Awards
 * duration-weighted points only if the usage cleared the minimum training
 * time; never blocks the caller's own flow on failure.
 *
 * @param {string} userId
 * @param {string} [reason] - human-readable reason recorded on the point transaction
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
    // Points/achievements are best-effort; never block the checkout/scan flow.
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

// Attaches the "want to turn machine tracking back on?" prompt to a machine
// scan result when the scanning user has machineTrackingOptOut set but went
// ahead and scanned a machine QR anyway.
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

    // The user opted out of having machine QRs tracked. That preference
    // still governs whether *unprompted* machine
    // data gets used for anything (e.g. AI routine suggestions — see
    // routine.service.js#getPatternSuggestion), but if they go ahead and
    // scan a machine QR anyway, we don't silently drop it: the scan is
    // registered like any other (MachineUsage is created/updated normally),
    // and the response is flagged so the app can ask the user whether they
    // want to turn machine tracking back on now that they've shown they're
    // actually using it. If they decline, nothing changes — they keep using
    // the app without ever needing to scan a machine QR, but the next one
    // they do scan is registered and prompted the same way.
    const scannerSettings = await prisma.userSettings.findUnique({
      where: { userId: scannerId },
      select: { machineTrackingOptOut: true },
    });

    const machineTrackingOptedOut = Boolean(scannerSettings?.machineTrackingOptOut);

    // Any machine scan proves the user is still physically in the gym —
    // cancel a pending auto-checkout if one was scheduled/applied.
    await reopenSessionIfAutoClosed(scannerId).catch(() => {});

    const openUsage = await prisma.machineUsage.findFirst({
      where: { userId: scannerId, machineId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (openUsage) {
      // Duration-weighted points, gated by the same minimum-time floor as
      // before (see computeMachineUsagePoints / closeOpenMachineUsage).
      const updated = await closeOpenMachineUsage(scannerId, "Machine usage ended");
      return withOptOutPrompt(shapeMachineUsage(updated), machineTrackingOptedOut);
    }

    // Scanning a *different* machine without ending the previous one used to
    // leave that MachineUsage open forever. Close it out first (also
    // handles the "starting a different machine auto-closes the previous
    // one" rule) so every usage record is properly bounded.
    const otherOpenUsage = await prisma.machineUsage.findFirst({
      where: { userId: scannerId, endedAt: null, machineId: { not: machineId } },
      orderBy: { startedAt: "desc" },
    });

    if (otherOpenUsage) {
      await closeOpenMachineUsage(scannerId, "Machine usage auto-closed (started a different machine)");
    }

    // Another user's usage is still open on THIS machine right now (two
    // people on the same machine). Flag it as suspicious and let
    // trainers verify — the new usage is still created below (both keep
    // figuring as using it until a trainer resolves it, or it auto-expires
    // into a mutual complaint — see machineConflict.service.js).
    const concurrentUsageByOther = await prisma.machineUsage.findFirst({
      where: { machineId, endedAt: null, userId: { not: scannerId } },
      orderBy: { startedAt: "asc" },
    });

    let activeSession = await prisma.gymSession.findFirst({
      where: { userId: scannerId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    // If the user never scanned a check-in but did scan a machine, mark
    // that scan as both a machine usage AND a check-in: a machine scan
    // that starts a new usage implies
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

    // No points here: awarding on "start" is what let a user farm points by
    // rapidly hopping between machines' start QR codes without training.
    // Points for this cycle are awarded once, on the matching "end" scan
    // above, and only if real time was actually spent (see the duration
    // check there).

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
