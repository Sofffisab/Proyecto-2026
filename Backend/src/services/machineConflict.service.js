import { prisma } from "../config/index.js";
import { createNotification } from "./communication.service.js";
import { addPoints } from "./gamification.service.js";
import { POINTS, MACHINE_CONFLICT_VERIFICATION_WINDOW_MS } from "../constants/points.js";
import { logger } from "../utils/logger.js";
import { MESSAGES } from "../locales/es.js";

/** Raises a MachineConflict for two overlapping usages on the same machine and notifies all trainers. Idempotent per machine. */
export async function flagMachineConflict({ machineId, firstUsage, secondUsage }) {
  const existing = await prisma.machineConflict.findFirst({
    where: { machineId, resolvedAt: null },
  });
  if (existing) return existing;

  const conflict = await prisma.machineConflict.create({
    data: {
      machineId,
      firstUserId: firstUsage.userId,
      secondUserId: secondUsage.userId,
      firstUsageId: firstUsage.id,
      secondUsageId: secondUsage.id,
    },
  });

  try {
    const machine = await prisma.machine.findUnique({ where: { id: machineId } });
    const trainers = await prisma.user.findMany({
      where: { role: "TRAINER", isActive: true },
      select: { id: true },
    });

    const title = MESSAGES.MACHINE_CONFLICT_TITLE;
    const body = MESSAGES.machineConflictBody(machine?.name ?? machineId);

    await Promise.all(
      trainers.map((t) => createNotification(t.id, title, body))
    );

    if (trainers.length > 0) {
      await prisma.machineConflict.update({
        where: { id: conflict.id },
        data: { notifiedTrainers: true },
      });
    }

    try {
      const { emitNotificationEvent } = await import("../realtime/ably.js");
      emitNotificationEvent({
        type: "MACHINE_CONFLICT",
        conflictId: conflict.id,
        machineId,
        machineName: machine?.name,
      });
    } catch (err) {
      logger.error("[machineConflict] Failed to emit realtime event:", err.message);
    }
  } catch (err) {
    logger.error("[machineConflict] Failed to notify trainers:", err.message);
  }

  return conflict;
}

/** Trainer-facing: conflicts still awaiting verification. */
export async function getPendingConflicts() {
  return prisma.machineConflict.findMany({
    where: { resolvedAt: null },
    include: {
      machine: true,
      firstUser: { select: { id: true, firstName: true, lastName: true } },
      secondUser: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { detectedAt: "asc" },
  });
}

/** Trainer resolves the conflict in person, closing the usage(s) of whoever wasn't really there. */
export async function resolveConflict(conflictId, trainerId, resolution) {
  const conflict = await prisma.machineConflict.findUnique({ where: { id: conflictId } });
  if (!conflict) throw new Error("Machine conflict not found");
  if (conflict.resolvedAt) throw new Error("This conflict was already resolved");

  const usersNotPresent = [];
  if (resolution === "NEITHER_PRESENT") {
    usersNotPresent.push(conflict.firstUsageId, conflict.secondUsageId);
  } else if (resolution === "ONLY_FIRST") {
    usersNotPresent.push(conflict.secondUsageId);
  } else if (resolution === "ONLY_SECOND") {
    usersNotPresent.push(conflict.firstUsageId);
  }
  // BOTH_PRESENT: nothing to close

  for (const usageId of usersNotPresent) {
    const usage = await prisma.machineUsage.findUnique({ where: { id: usageId } });
    if (usage && !usage.endedAt) {
      await prisma.machineUsage.update({
        where: { id: usageId },
        data: { endedAt: new Date(), durationMinutes: 0 },
      });
    }
  }

  const updated = await prisma.machineConflict.update({
    where: { id: conflictId },
    data: { resolvedAt: new Date(), resolvedBy: trainerId, resolution },
  });

  // Small bonus for the trainer who helped keep order
  addPoints(trainerId, POINTS.TRAINER_ORDER_BONUS, "Verified a machine-usage conflict").catch((err) =>
    logger.error("[machineConflict] Failed to award trainer order bonus:", err.message)
  );

  return updated;
}

/** Cron: marks conflicts unresolved past the verification window as UNVERIFIED and raises a mutual complaint. */
export async function expireUnverifiedConflicts() {
  const cutoff = new Date(Date.now() - MACHINE_CONFLICT_VERIFICATION_WINDOW_MS);

  const stale = await prisma.machineConflict.findMany({
    where: { resolvedAt: null, detectedAt: { lte: cutoff } },
  });

  if (stale.length === 0) return { expired: 0 };

  // Lazy import to avoid a require-cycle
  const { createAutoMachineConflictComplaint } = await import("./complaint.service.js");

  let expired = 0;
  for (const conflict of stale) {
    try {
      await prisma.machineConflict.update({
        where: { id: conflict.id },
        data: { resolvedAt: new Date(), resolution: "UNVERIFIED" },
      });

      // Mutual complaint: no system account to attribute fault to either side
      await createAutoMachineConflictComplaint({
        reporterId: conflict.secondUserId,
        reportedUserId: conflict.firstUserId,
        conflictId: conflict.id,
      });
      await createAutoMachineConflictComplaint({
        reporterId: conflict.firstUserId,
        reportedUserId: conflict.secondUserId,
        conflictId: conflict.id,
      });

      expired++;
    } catch (err) {
      logger.error(`[machineConflict] Failed to expire conflict ${conflict.id}:`, err.message);
    }
  }

  return { expired };
}
