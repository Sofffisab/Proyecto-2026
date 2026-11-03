// Exit pop-up (shown after the exit QR scan): rate the day, rate the trainers
// who helped, and "Denuncias" — report a trainer (bad behaviour / lied about
// helping), a broken machine, or another member who misbehaved.
//
// Two requests keep it light: GET the context (who/what was in the gym during
// the visit) when the pop-up opens, POST everything once when it is sent.
// Reports are stored in the `denuncias` table (model Denuncia).

import { prisma } from "../config/index.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { DENUNCIA_MESSAGES } from "../locales/es.js";
import { rateTrainer } from "./gym.service.js";

export const DENUNCIA_TYPES = ["TRAINER_MISCONDUCT", "TRAINER_FALSE_HELP", "MACHINE_BROKEN", "MEMBER_MISCONDUCT"];
const TRAINER_TYPES = ["TRAINER_MISCONDUCT", "TRAINER_FALSE_HELP"];
const MAX_PEOPLE_LISTED = 200;

const fullName = (u) => `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();

async function loadFinishedSession(sessionId, userId) {
  const session = await prisma.gymSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError(DENUNCIA_MESSAGES.SESSION_NOT_FOUND, 404);
  if (session.userId !== userId) throw new AppError(DENUNCIA_MESSAGES.SESSION_NOT_YOURS, 403);
  if (!session.checkOutAt) throw new AppError(DENUNCIA_MESSAGES.SESSION_NOT_FINISHED, 400);
  return session;
}

/**
 * What the exit pop-up needs, in one request:
 *  - trainersHelped:  trainers who completed an assistance for this member during the visit
 *                     (with `rated` so we don't ask for a rating twice)
 *  - trainersPresent: trainers who were in the gym at the same time (to report one)
 *  - members:         other members who were in the gym at the same time (to report one)
 *  - machines:        every active machine of the gym (to report a broken one)
 */
export async function getCheckoutContext(sessionId, userId) {
  const session = await loadFinishedSession(sessionId, userId);

  const [overlapping, assistances, ratings, machines] = await Promise.all([
    // Everybody whose visit overlapped with this one.
    prisma.gymSession.findMany({
      where: {
        userId: { not: userId },
        checkInAt: { lte: session.checkOutAt },
        OR: [{ checkOutAt: null }, { checkOutAt: { gte: session.checkInAt } }],
        user: { isActive: true },
      },
      select: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      take: 500,
    }),
    prisma.assistance.findMany({
      where: {
        userId,
        status: "COMPLETED",
        trainerId: { not: null },
        completedAt: { gte: session.checkInAt, lte: session.checkOutAt },
      },
      select: { trainer: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.trainerRating.findMany({
      where: { userId, gymSessionId: sessionId },
      select: { trainerId: true },
    }),
    prisma.machine.findMany({
      where: { active: true },
      select: { id: true, name: true, zone: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const ratedIds = new Set((ratings ?? []).map((r) => r.trainerId));

  const trainersHelped = new Map();
  for (const a of assistances ?? []) {
    if (a.trainer) trainersHelped.set(a.trainer.id, { id: a.trainer.id, name: fullName(a.trainer), rated: ratedIds.has(a.trainer.id) });
  }

  const trainersPresent = new Map();
  const members = new Map();
  for (const row of overlapping ?? []) {
    const u = row.user;
    if (!u) continue;
    if (u.role === "TRAINER") trainersPresent.set(u.id, { id: u.id, name: fullName(u) });
    else if (u.role === "USER") members.set(u.id, { id: u.id, name: fullName(u) });
  }
  // A trainer who helped is, by definition, one who was there.
  for (const t of trainersHelped.values()) {
    if (!trainersPresent.has(t.id)) trainersPresent.set(t.id, { id: t.id, name: t.name });
  }

  const byName = (a, b) => a.name.localeCompare(b.name, "es");

  return {
    sessionId: session.id,
    dayRating: session.dayRating ?? null,
    trainersHelped: [...trainersHelped.values()].sort(byName),
    trainersPresent: [...trainersPresent.values()].sort(byName),
    members: [...members.values()].sort(byName).slice(0, MAX_PEOPLE_LISTED),
    machines: machines ?? [],
  };
}

/** Checks one denuncia against what was really in the gym and returns the row to insert. */
function validateDenuncia(item, context, reporterId, gymSessionId) {
  const comment = item.comment?.trim() || null;

  if (item.type === "MACHINE_BROKEN") {
    if (!context.machines.some((m) => m.id === item.machineId)) {
      throw new AppError(DENUNCIA_MESSAGES.MACHINE_NOT_FOUND, 404);
    }
    return { reporterId, gymSessionId, type: item.type, machineId: item.machineId, comment };
  }

  if (item.reportedUserId === reporterId) throw new AppError(DENUNCIA_MESSAGES.CANNOT_REPORT_SELF, 400);

  if (TRAINER_TYPES.includes(item.type)) {
    if (!context.trainersPresent.some((t) => t.id === item.reportedUserId)) {
      throw new AppError(DENUNCIA_MESSAGES.TRAINER_NOT_PRESENT, 400);
    }
  } else if (!context.members.some((m) => m.id === item.reportedUserId)) {
    throw new AppError(DENUNCIA_MESSAGES.MEMBER_NOT_PRESENT, 400);
  }

  return { reporterId, gymSessionId, type: item.type, reportedUserId: item.reportedUserId, comment };
}

/**
 * Saves the exit pop-up: day rating, trainer ratings and denuncias.
 * Every piece is optional. Denuncias are validated first, all-or-nothing, so a
 * bad one never leaves the rest half saved. Sending the same denuncia twice is
 * harmless (it is stored once per visit).
 */
export async function submitCheckoutFeedback(sessionId, userId, { dayRating, trainerRatings = [], denuncias = [] } = {}) {
  const session = await loadFinishedSession(sessionId, userId);

  let context = null;
  let rows = [];
  if (denuncias.length > 0) {
    context = await getCheckoutContext(sessionId, userId);
    rows = denuncias.map((item) => validateDenuncia(item, context, userId, session.id));
  }

  if (dayRating != null) {
    await prisma.gymSession.update({ where: { id: session.id }, data: { dayRating } });
  }

  const ratingResults = [];
  for (const { trainerId, rating } of trainerRatings) {
    try {
      await rateTrainer(session.id, userId, trainerId, rating, true);
      ratingResults.push({ trainerId, ok: true });
    } catch (err) {
      // Already rated / no assistance found: report it, but keep the rest.
      ratingResults.push({ trainerId, ok: false, error: err.message });
    }
  }

  const created = [];
  for (const data of rows) {
    const existing = await prisma.denuncia.findFirst({
      where: {
        reporterId: userId,
        gymSessionId: session.id,
        type: data.type,
        reportedUserId: data.reportedUserId ?? null,
        machineId: data.machineId ?? null,
      },
      select: { id: true },
    });
    if (existing) continue;
    created.push(await prisma.denuncia.create({ data }));
  }

  if (created.length > 0) logger.info(`[denuncias] ${created.length} nueva(s) de ${userId} en la visita ${session.id}`);

  return { dayRating: dayRating ?? session.dayRating ?? null, ratings: ratingResults, denuncias: created.length };
}

// ── admin ────────────────────────────────────────────────────────────────

/** Admin list of denuncias, newest first, with readable names. */
export async function listDenuncias({ status, limit = 50, offset = 0 } = {}) {
  const rows = await prisma.denuncia.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200),
    skip: Math.max(parseInt(offset, 10) || 0, 0),
    include: {
      reporter: { select: { id: true, firstName: true, lastName: true } },
      reported: { select: { id: true, firstName: true, lastName: true, role: true } },
      machine: { select: { id: true, name: true, zone: true } },
    },
  });

  return rows.map((d) => ({
    id: d.id,
    type: d.type,
    status: d.status,
    comment: d.comment,
    gymSessionId: d.gymSessionId,
    createdAt: d.createdAt,
    reporter: d.reporter ? { id: d.reporter.id, name: fullName(d.reporter) } : null,
    reported: d.reported ? { id: d.reported.id, name: fullName(d.reported), role: d.reported.role } : null,
    machine: d.machine ?? null,
  }));
}

export async function updateDenunciaStatus(id, status) {
  const existing = await prisma.denuncia.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError("Denuncia not found", 404);
  return prisma.denuncia.update({ where: { id }, data: { status } });
}
