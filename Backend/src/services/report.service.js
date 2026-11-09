// Admin review of reports. Two kinds of rows are reviewed together because to
// the admin they are the same thing — "someone reported something":
//   - COMPLAINT: member -> person reports, trainer reports, and the automatic
//                ones ("no me ayudaron", machine conflict nobody verified)
//   - DENUNCIA:  what a member reports from the exit pop-up (trainer, member or
//                broken machine) and what a trainer reports about a machine
//
// Admin decisions: accept (takes points from the reported person, progressive
// penalty shared by both kinds), reject, escalate (passed to a higher level:
// talking to the person or deactivating the account happens outside the app)
// and revert (undo an accepted report, giving the points back).

import { prisma } from "../config/index.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { addPoints } from "./gamification.service.js";
import { notifyLocalized } from "../locales/notifications.js";
import { logActivity, ACTIVITY } from "./activityLog.service.js";
import { signalStaff, TOPIC } from "../realtime/staffSignal.js";
import { calculateComplaintPenalty, countAcceptedReportsAgainst } from "./complaint.service.js";
import { SUSPICIOUS_REPORTS } from "../constants/points.js";

export const REPORT_KINDS = ["COMPLAINT", "DENUNCIA"];
// Normalized states the admin screen works with.
export const REPORT_STATES = ["PENDING", "ESCALATED", "ACCEPTED", "REJECTED"];

const DAY_MS = 86_400_000;
const MAX_ROWS = 100;
const SYSTEM_REVIEW_PREFIXES = ["REPEAT_COMPLAINTS", "SUSPICIOUS_BEHAVIOR", "POINTS_CEILING_HIT"];

const PERSON = { id: true, firstName: true, lastName: true, email: true, role: true };

const displayName = (u) => {
  if (!u) return null;
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name || u.email || null;
};
const person = (u) => (u ? { id: u.id, name: displayName(u), role: u.role } : null);

const COMPLAINT_STATE = { PENDING: "PENDING", APPROVED: "ACCEPTED", REJECTED: "REJECTED", ESCALATED: "ESCALATED" };
const DENUNCIA_STATE = { PENDING: "PENDING", REVIEWED: "ACCEPTED", DISMISSED: "REJECTED", ESCALATED: "ESCALATED" };

const DB_STATUS = {
  COMPLAINT: { PENDING: "PENDING", ACCEPTED: "APPROVED", REJECTED: "REJECTED", ESCALATED: "ESCALATED" },
  DENUNCIA: { PENDING: "PENDING", ACCEPTED: "REVIEWED", REJECTED: "DISMISSED", ESCALATED: "ESCALATED" },
};

function normalizeComplaint(c) {
  return {
    kind: "COMPLAINT",
    id: c.id,
    state: COMPLAINT_STATE[c.status] ?? c.status,
    source: c.source,
    reason: c.reason,
    comment: c.source === "AUTO_MACHINE_CONFLICT" ? null : c.message ?? null,
    createdAt: c.createdAt,
    reviewedAt: c.reviewedAt ?? null,
    penaltyPoints: c.penaltyPoints ?? 0,
    reporter: person(c.reporter),
    reported: person(c.reported),
    machine: null,
  };
}

function normalizeDenuncia(d) {
  return {
    kind: "DENUNCIA",
    id: d.id,
    state: DENUNCIA_STATE[d.status] ?? d.status,
    source: d.type,
    reason: d.type,
    comment: d.comment ?? null,
    createdAt: d.createdAt,
    reviewedAt: d.reviewedAt ?? null,
    penaltyPoints: d.penaltyPoints ?? 0,
    reporter: person(d.reporter),
    reported: person(d.reported),
    machine: d.machine ? { id: d.machine.id, name: d.machine.name } : null,
  };
}

function assertKind(kind) {
  if (!REPORT_KINDS.includes(kind)) throw new AppError("Unknown report kind", 400);
}

async function loadReport(kind, id) {
  assertKind(kind);
  const row =
    kind === "COMPLAINT"
      ? await prisma.complaint.findUnique({ where: { id }, include: { reporter: { select: PERSON }, reported: { select: PERSON } } })
      : await prisma.denuncia.findUnique({
          where: { id },
          include: { reporter: { select: PERSON }, reported: { select: PERSON }, machine: { select: { id: true, name: true } } },
        });
  if (!row) throw new AppError("Report not found", 404);
  return { row, view: kind === "COMPLAINT" ? normalizeComplaint(row) : normalizeDenuncia(row) };
}

async function setStatus(kind, id, state, adminId, extra = {}) {
  const data = { status: DB_STATUS[kind][state], reviewedAt: new Date(), ...extra };
  if (kind === "COMPLAINT") return prisma.complaint.update({ where: { id }, data: { ...data, reviewedBy: adminId } });
  return prisma.denuncia.update({ where: { id }, data: { ...data, reviewedBy: adminId } });
}

// ── Listing ──────────────────────────────────────────────────────────────

async function priorReportsByPerson(reportedIds) {
  if (reportedIds.length === 0) return new Map();

  const [complaints, denuncias] = await Promise.all([
    prisma.complaint.findMany({
      where: { reportedUserId: { in: reportedIds } },
      select: { id: true, reportedUserId: true, status: true, reason: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.denuncia.findMany({
      where: { reportedUserId: { in: reportedIds } },
      select: { id: true, reportedUserId: true, status: true, type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  const byPerson = new Map();
  const push = (userId, entry) => {
    if (!byPerson.has(userId)) byPerson.set(userId, []);
    byPerson.get(userId).push(entry);
  };
  (complaints ?? []).forEach((c) =>
    push(c.reportedUserId, { kind: "COMPLAINT", id: c.id, state: COMPLAINT_STATE[c.status], reason: c.reason, createdAt: c.createdAt })
  );
  (denuncias ?? []).forEach((d) =>
    push(d.reportedUserId, { kind: "DENUNCIA", id: d.id, state: DENUNCIA_STATE[d.status], reason: d.type, createdAt: d.createdAt })
  );
  byPerson.forEach((list) => list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  return byPerson;
}

function summarizeHistory(all, excludeId) {
  const others = all.filter((r) => r.id !== excludeId);
  return {
    total: others.length,
    accepted: others.filter((r) => r.state === "ACCEPTED").length,
    rejected: others.filter((r) => r.state === "REJECTED").length,
    pending: others.filter((r) => r.state === "PENDING" || r.state === "ESCALATED").length,
    recent: others.slice(0, 5),
  };
}

/** Reports in one state (default PENDING), newest first, with the reported person's earlier reports. */
export async function listReports({ state = "PENDING", limit = MAX_ROWS } = {}) {
  if (!REPORT_STATES.includes(state)) throw new AppError("Unknown report state", 400);
  const take = Math.min(Math.max(parseInt(limit, 10) || MAX_ROWS, 1), MAX_ROWS);

  const [complaints, denuncias] = await Promise.all([
    prisma.complaint.findMany({
      where: { status: DB_STATUS.COMPLAINT[state] },
      orderBy: { createdAt: "desc" },
      take,
      include: { reporter: { select: PERSON }, reported: { select: PERSON } },
    }),
    prisma.denuncia.findMany({
      where: { status: DB_STATUS.DENUNCIA[state] },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        reporter: { select: PERSON },
        reported: { select: PERSON },
        machine: { select: { id: true, name: true } },
      },
    }),
  ]);

  const items = [...(complaints ?? []).map(normalizeComplaint), ...(denuncias ?? []).map(normalizeDenuncia)]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, take);

  const reportedIds = [...new Set(items.map((i) => i.reported?.id).filter(Boolean))];
  const history = await priorReportsByPerson(reportedIds);

  let pointsByUser = new Map();
  let strikesByUser = new Map();
  if (state === "PENDING" || state === "ESCALATED") {
    const sums = await Promise.all(
      reportedIds.map(async (userId) => {
        const [agg, strikes] = await Promise.all([
          prisma.pointTransaction.aggregate({ where: { userId }, _sum: { points: true } }),
          countAcceptedReportsAgainst(userId),
        ]);
        return [userId, agg?._sum?.points ?? 0, strikes ?? 0];
      })
    );
    pointsByUser = new Map(sums.map(([id, points]) => [id, points]));
    strikesByUser = new Map(sums.map(([id, , strikes]) => [id, strikes]));
  }

  return items.map((item) => {
    const userId = item.reported?.id;
    if (!userId) return { ...item, previousReports: null, points: null, nextPenalty: null };
    return {
      ...item,
      previousReports: summarizeHistory(history.get(userId) ?? [], item.id),
      points: pointsByUser.get(userId) ?? null,
      // What accepting this report would take from them (0 = still free strikes).
      nextPenalty:
        state === "PENDING" || state === "ESCALATED"
          ? Math.abs(calculateComplaintPenalty((strikesByUser.get(userId) ?? 0) + 1))
          : null,
    };
  });
}

/** How many reports are waiting in each state — for the badges of the screen. */
export async function getReportCounts() {
  const count = async (state) => {
    const [c, d] = await Promise.all([
      prisma.complaint.count({ where: { status: DB_STATUS.COMPLAINT[state] } }),
      prisma.denuncia.count({ where: { status: DB_STATUS.DENUNCIA[state] } }),
    ]);
    return (c ?? 0) + (d ?? 0);
  };
  const [pending, escalated, accepted] = await Promise.all([count("PENDING"), count("ESCALATED"), count("ACCEPTED")]);
  return { pending, escalated, accepted };
}

// ── Decisions ────────────────────────────────────────────────────────────

/** Accept: the reported person loses points following the progressive penalty. */
export async function acceptReport(kind, id, adminId) {
  const { view } = await loadReport(kind, id);
  if (view.state !== "PENDING" && view.state !== "ESCALATED") {
    throw new AppError("This report was already reviewed", 409);
  }

  await setStatus(kind, id, "ACCEPTED", adminId);

  let penalty = 0;
  const reportedId = view.reported?.id;

  if (reportedId) {
    const strikes = await countAcceptedReportsAgainst(reportedId); // includes this one now
    penalty = Math.abs(calculateComplaintPenalty(strikes));

    if (penalty > 0) {
      await addPoints(reportedId, -penalty, `Report accepted by an administrator (strike #${strikes})`);
      await setStatusPenalty(kind, id, penalty);
      await notifyLocalized(reportedId, "REPORT_PENALTY", { points: penalty });
    } else {
      await notifyLocalized(reportedId, "REPORT_NO_PENALTY");
    }
  }

  await logActivity({
    actorId: adminId,
    action: ACTIVITY.REPORT_ACCEPTED,
    entityType: kind,
    entityId: id,
    metadata: { subject: view.reported?.name ?? view.machine?.name ?? null, points: penalty },
  });

  signalStaff(TOPIC.REPORTS);
  return { id, kind, state: "ACCEPTED", penalty };
}

async function setStatusPenalty(kind, id, penaltyPoints) {
  if (kind === "COMPLAINT") return prisma.complaint.update({ where: { id }, data: { penaltyPoints } });
  return prisma.denuncia.update({ where: { id }, data: { penaltyPoints } });
}

export async function rejectReport(kind, id, adminId) {
  const { view } = await loadReport(kind, id);
  if (view.state !== "PENDING" && view.state !== "ESCALATED") {
    throw new AppError("This report was already reviewed", 409);
  }

  await setStatus(kind, id, "REJECTED", adminId);
  await logActivity({
    actorId: adminId,
    action: ACTIVITY.REPORT_REJECTED,
    entityType: kind,
    entityId: id,
    metadata: { subject: view.reported?.name ?? view.machine?.name ?? null },
  });
  signalStaff(TOPIC.REPORTS);
  return { id, kind, state: "REJECTED", penalty: 0 };
}

/** Pass it to a higher level. No points move and nobody is notified: it is handled outside the app. */
export async function escalateReport(kind, id, adminId) {
  const { view } = await loadReport(kind, id);
  if (view.state !== "PENDING") throw new AppError("Only pending reports can be escalated", 409);

  await setStatus(kind, id, "ESCALATED", adminId);
  await logActivity({
    actorId: adminId,
    action: ACTIVITY.REPORT_ESCALATED,
    entityType: kind,
    entityId: id,
    metadata: { subject: view.reported?.name ?? view.machine?.name ?? null },
  });
  signalStaff(TOPIC.REPORTS);
  return { id, kind, state: "ESCALATED", penalty: 0 };
}

/** Undo an accepted report: it is marked rejected and the points it took go back. */
export async function revertReport(kind, id, adminId) {
  const { view } = await loadReport(kind, id);
  if (view.state !== "ACCEPTED") throw new AppError("Only accepted reports can be removed", 409);

  const refund = view.penaltyPoints ?? 0;
  await setStatus(kind, id, "REJECTED", adminId, { penaltyPoints: null });

  if (view.reported?.id && refund > 0) {
    await addPoints(view.reported.id, refund, "Report removed by an administrator: points returned");
    await notifyLocalized(view.reported.id, "POINTS_RETURNED", { points: refund });
  }

  await logActivity({
    actorId: adminId,
    action: ACTIVITY.REPORT_REVERTED,
    entityType: kind,
    entityId: id,
    metadata: { subject: view.reported?.name ?? view.machine?.name ?? null, points: refund },
  });
  signalStaff(TOPIC.REPORTS);
  return { id, kind, state: "REJECTED", refunded: refund };
}

// ── Suspicious behavior + review requests ───────────────────────────────

/** People who received or made unusually many reports lately (computed, not stored). */
export async function getSuspiciousBehavior() {
  const { WINDOW_DAYS, RECEIVED_THRESHOLD, MADE_THRESHOLD } = SUSPICIOUS_REPORTS;
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  const [complaints, denuncias] = await Promise.all([
    prisma.complaint.findMany({
      where: { createdAt: { gte: since } },
      select: { reporterId: true, reportedUserId: true, source: true },
    }),
    prisma.denuncia.findMany({
      where: { createdAt: { gte: since } },
      select: { reporterId: true, reportedUserId: true },
    }),
  ]);

  const received = new Map();
  const made = new Map();
  const bump = (map, id) => id && map.set(id, (map.get(id) ?? 0) + 1);

  (complaints ?? []).forEach((c) => {
    bump(received, c.reportedUserId);
    // Automatic complaints are filed by the system on behalf of someone: they are not "made" by that person.
    if (!String(c.source ?? "").startsWith("AUTO_")) bump(made, c.reporterId);
  });
  (denuncias ?? []).forEach((d) => {
    bump(received, d.reportedUserId);
    bump(made, d.reporterId);
  });

  const flagged = [
    ...[...received].filter(([, n]) => n >= RECEIVED_THRESHOLD).map(([userId, count]) => ({ userId, kind: "received", count })),
    ...[...made].filter(([, n]) => n >= MADE_THRESHOLD).map(([userId, count]) => ({ userId, kind: "made", count })),
  ];
  if (flagged.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(flagged.map((f) => f.userId))] } },
    select: PERSON,
  });
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  return flagged
    .map((f) => ({ ...f, name: displayName(byId.get(f.userId)), days: WINDOW_DAYS }))
    .sort((a, b) => b.count - a.count);
}

/** Every recent report received and made by one person (the "ver detalle" of the suspicious list). */
export async function getReportsOfUser(userId, { days = 30 } = {}) {
  const since = new Date(Date.now() - days * DAY_MS);
  const include = { reporter: { select: PERSON }, reported: { select: PERSON } };

  const [cRec, cMade, dRec, dMade] = await Promise.all([
    prisma.complaint.findMany({ where: { reportedUserId: userId, createdAt: { gte: since } }, include, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.complaint.findMany({ where: { reporterId: userId, createdAt: { gte: since } }, include, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.denuncia.findMany({ where: { reportedUserId: userId, createdAt: { gte: since } }, include: { ...include, machine: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.denuncia.findMany({ where: { reporterId: userId, createdAt: { gte: since } }, include: { ...include, machine: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  const sort = (list) => list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return {
    received: sort([...(cRec ?? []).map(normalizeComplaint), ...(dRec ?? []).map(normalizeDenuncia)]),
    made: sort([...(cMade ?? []).map(normalizeComplaint), ...(dMade ?? []).map(normalizeDenuncia)]),
  };
}

/**
 * Members asking for a review ("I think a report against me was wrong"), each
 * with their latest accepted reports so the admin can remove the right one.
 * Alerts raised by the system itself are not listed here.
 */
export async function listReviewRequests() {
  const rows = await prisma.pointReviewRequest.findMany({
    where: { resolved: false },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { user: { select: PERSON } },
  });

  const requests = (rows ?? []).filter((r) => !SYSTEM_REVIEW_PREFIXES.some((p) => String(r.reason).startsWith(p)));

  return Promise.all(
    requests.map(async (r) => {
      const [complaints, denuncias] = await Promise.all([
        prisma.complaint.findMany({
          where: { reportedUserId: r.userId, status: "APPROVED" },
          include: { reporter: { select: PERSON }, reported: { select: PERSON } },
          orderBy: { reviewedAt: "desc" },
          take: 5,
        }),
        prisma.denuncia.findMany({
          where: { reportedUserId: r.userId, status: "REVIEWED" },
          include: { reporter: { select: PERSON }, reported: { select: PERSON }, machine: { select: { id: true, name: true } } },
          orderBy: { reviewedAt: "desc" },
          take: 5,
        }),
      ]);

      const acceptedReports = [...(complaints ?? []).map(normalizeComplaint), ...(denuncias ?? []).map(normalizeDenuncia)]
        .sort((a, b) => new Date(b.reviewedAt ?? b.createdAt) - new Date(a.reviewedAt ?? a.createdAt))
        .slice(0, 5);

      return { id: r.id, createdAt: r.createdAt, message: r.reason, user: person(r.user), acceptedReports };
    })
  );
}

export async function resolveReviewRequest(id, adminId) {
  const existing = await prisma.pointReviewRequest.findUnique({ where: { id }, include: { user: { select: PERSON } } });
  if (!existing) throw new AppError("Review request not found", 404);
  if (existing.resolved) throw new AppError("This request was already reviewed", 409);

  await prisma.pointReviewRequest.update({ where: { id }, data: { resolved: true, reviewedBy: adminId } });
  await logActivity({
    actorId: adminId,
    action: ACTIVITY.REVIEW_REQUEST_RESOLVED,
    entityType: "PointReviewRequest",
    entityId: id,
    metadata: { user: displayName(existing.user) },
  });
  return { id, resolved: true };
}

// Used by the trainer's "Denunciar" screen for machines (no person involved).
export async function createMachineDenuncia({ reporterId, machineId, comment }) {
  const machine = await prisma.machine.findUnique({ where: { id: machineId } });
  if (!machine || !machine.active) throw new AppError("Machine not found", 404);

  const created = await prisma.denuncia.create({
    data: { reporterId, type: "MACHINE_BROKEN", machineId, comment: comment?.trim() || null },
  });
  signalStaff(TOPIC.REPORTS);
  logger.info(`[reports] Machine denuncia ${created.id} on ${machine.name} by ${reporterId}`);
  return created;
}
