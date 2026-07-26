import { prisma } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { dispatchPendingAssistance } from "../services/assistance.service.js";

// How long a gym session can stay open before the system closes it
// automatically (user forgot to scan the exit QR).
const AUTO_CHECKOUT_HOURS = parseInt(process.env.AUTO_CHECKOUT_HOURS ?? "4", 10);

// How long a machine usage can stay open before it's considered abandoned
// (user walked away without ending it and never touched another machine).
const MACHINE_USAGE_TIMEOUT_HOURS = parseInt(process.env.MACHINE_USAGE_TIMEOUT_HOURS ?? "3", 10);

/** Closes entities left open past their time limit (gym sessions, machine usage, challenges) — one job for all three, same underlying pattern. */
export async function expireStaleEntities() {
  await Promise.all([
    autoCheckoutStaleGymSessions(),
    autoCloseAbandonedMachineUsages(),
    expireStaleSocialChallenges(),
    dispatchPendingAssistance().catch((err) =>
      logger.error("[expiration.job] Failed to sweep assistance alert queue:", err.message)
    ),
  ]);
}

async function autoCheckoutStaleGymSessions() {
  const cutoff = new Date(Date.now() - AUTO_CHECKOUT_HOURS * 60 * 60 * 1000);

  const stale = await prisma.gymSession.findMany({
    where: { checkOutAt: null, checkInAt: { lt: cutoff } },
    select: { id: true, checkInAt: true },
  });

  if (stale.length === 0) {
    logger.info("[expiration.job] No stale gym sessions to auto-checkout.");
    return;
  }

  for (const session of stale) {
    const checkOutAt = new Date();
    const durationMinutes = Math.round((checkOutAt - session.checkInAt) / 60000);
    await prisma.gymSession.update({
      where: { id: session.id },
      data: { checkOutAt, durationMinutes, autoClosed: true },
    });
  }

  logger.info(`[expiration.job] Auto-checked-out ${stale.length} stale gym session(s).`);
}

async function autoCloseAbandonedMachineUsages() {
  const cutoff = new Date(Date.now() - MACHINE_USAGE_TIMEOUT_HOURS * 60 * 60 * 1000);

  const stale = await prisma.machineUsage.findMany({
    where: { endedAt: null, startedAt: { lt: cutoff } },
    select: { id: true, startedAt: true },
  });

  if (stale.length === 0) {
    logger.info("[expiration.job] No abandoned machine usages to close.");
    return;
  }

  for (const usage of stale) {
    const endedAt = new Date();
    const durationMinutes = Math.max(1, Math.round((endedAt - usage.startedAt) / 60000));
    await prisma.machineUsage.update({
      where: { id: usage.id },
      data: { endedAt, durationMinutes },
    });
  }

  logger.info(`[expiration.job] Auto-closed ${stale.length} abandoned machine usage(s).`);
}

async function expireStaleSocialChallenges() {
  const now = new Date();

  const stale = await prisma.socialChallenge.findMany({
    where: {
      status: { in: ["ASSIGNED", "ACCEPTED"] },
      expiresAt: { not: null, lt: now },
    },
    select: { id: true },
  });

  if (stale.length === 0) {
    logger.info("[expiration.job] No stale social challenges to expire.");
    return;
  }

  await prisma.socialChallenge.updateMany({
    where: { id: { in: stale.map((c) => c.id) } },
    data: { status: "EXPIRED" },
  });

  logger.info(`[expiration.job] Expired ${stale.length} stale social challenge(s).`);
}
