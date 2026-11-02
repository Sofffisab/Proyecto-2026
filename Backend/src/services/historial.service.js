// Personal history ("Historial"): one row per thing that happens to a member
// inside the gym — entering, leaving, using a machine, being helped by a
// trainer and interacting with another member. Table: `historial`
// (model HistorialEvento).
//
// Writing is best-effort on purpose: a failure to log must never break the
// real action (check-in, scan, assistance...), so registrarEvento swallows and
// logs its errors and resolves to null.

import { prisma } from "../config/index.js";
import { logger } from "../utils/logger.js";

export const HISTORIAL_TIPOS = [
  "GYM_CHECK_IN",
  "GYM_CHECK_OUT",
  "MACHINE_USE",
  "TRAINER_ASSISTANCE",
  "SOCIAL_INTERACTION",
];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Records one history row. Never throws.
 *
 * @param {object} evento
 * @param {string} evento.userId        Owner of the history row.
 * @param {string} evento.tipo          One of HISTORIAL_TIPOS.
 * @param {string} [evento.otherUserId] Trainer / partner involved, if any.
 * @param {string} [evento.machineId]
 * @param {string} [evento.gymSessionId]
 * @param {object} [evento.metadata]    Small display snapshot (machine name, minutes, points...).
 * @param {Date}   [evento.occurredAt]  Defaults to now (pass the real moment for offline syncs).
 */
export async function registrarEvento({
  userId,
  tipo,
  otherUserId = null,
  machineId = null,
  gymSessionId = null,
  metadata = null,
  occurredAt,
}) {
  try {
    if (!userId || !HISTORIAL_TIPOS.includes(tipo)) return null;
    if (!prisma?.historialEvento?.create) return null;

    return await prisma.historialEvento.create({
      data: {
        userId,
        tipo,
        otherUserId,
        machineId,
        gymSessionId,
        metadata: metadata ?? undefined,
        ...(occurredAt ? { occurredAt } : {}),
      },
    });
  } catch (err) {
    logger.error(`[historial] No se pudo registrar ${tipo} para ${userId}: ${err.message}`);
    return null;
  }
}

/** Machine use. Looks the machine name up so the history keeps reading well later. */
export async function registrarUsoMaquina({ userId, machineId, gymSessionId = null, occurredAt }) {
  let machine = null;
  try {
    machine = await prisma.machine?.findUnique?.({
      where: { id: machineId },
      select: { name: true, zone: true },
    });
  } catch {
    // The name is only a display snapshot; log the use without it.
  }

  return registrarEvento({
    userId,
    tipo: "MACHINE_USE",
    machineId,
    gymSessionId,
    occurredAt,
    metadata: machine ? { machineName: machine.name, zone: machine.zone ?? null } : null,
  });
}

const fullName = (user) => (user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : null);

/**
 * The member's history, newest first, with cursor pagination.
 *
 * @param {string} userId
 * @param {object} [opts]
 * @param {number} [opts.limit]  1..200 (default 50)
 * @param {string|Date} [opts.before]  Return only rows older than this instant (the previous page's nextCursor).
 * @param {string} [opts.tipo]  Filter by one HISTORIAL_TIPOS value.
 * @returns {Promise<{items: object[], nextCursor: string|null}>}
 */
export async function getHistorial(userId, { limit = DEFAULT_LIMIT, before, tipo } = {}) {
  const take = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const where = { userId };
  if (before) {
    const beforeDate = new Date(before);
    if (!Number.isNaN(beforeDate.getTime())) where.occurredAt = { lt: beforeDate };
  }
  if (tipo && HISTORIAL_TIPOS.includes(tipo)) where.tipo = tipo;

  const rows = await prisma.historialEvento.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: { otherUser: { select: { id: true, firstName: true, lastName: true } } },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      occurredAt: row.occurredAt,
      otherUserId: row.otherUserId,
      otherUserName: fullName(row.otherUser),
      machineId: row.machineId,
      gymSessionId: row.gymSessionId,
      metadata: row.metadata ?? null,
    })),
    nextCursor: hasMore ? new Date(page[page.length - 1].occurredAt).toISOString() : null,
  };
}
