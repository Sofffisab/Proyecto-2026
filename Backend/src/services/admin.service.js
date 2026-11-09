// Admin screens: Miembros, Estadísticas and Historial.

import { prisma, redis } from "../config/index.js";
import { AppError } from "../utils/errors.js";
import { createUserByAdmin, resendInvite } from "./auth.service.js";
import { logActivity, ACTIVITY } from "./activityLog.service.js";

const STATS_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

const displayName = (u) => {
  if (!u) return null;
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name || u.email || null;
};

// ── Miembros ─────────────────────────────────────────────────────────────

export async function listMembers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      passwordResetToken: true,
      trainerProfile: { select: { averageRating: true, totalRatings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  return (users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: displayName(u),
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    // Created by an admin and the person has not chosen a password yet.
    invitePending: Boolean(u.passwordResetToken),
    rating: u.role === "TRAINER" && u.trainerProfile?.totalRatings > 0 ? Number(u.trainerProfile.averageRating.toFixed(1)) : null,
    ratingCount: u.role === "TRAINER" ? u.trainerProfile?.totalRatings ?? 0 : null,
  }));
}

export async function createMember(adminId, data) {
  const created = await createUserByAdmin(data);
  await logActivity({
    actorId: adminId,
    action: ACTIVITY.ACCOUNT_CREATED,
    entityType: "User",
    entityId: created.id,
    metadata: { email: created.email, role: created.role },
  });
  return created;
}

export async function resendMemberInvite(adminId, userId) {
  const result = await resendInvite(userId);
  await logActivity({
    actorId: adminId,
    action: ACTIVITY.INVITE_RESENT,
    entityType: "User",
    entityId: userId,
    metadata: { email: result.email },
  });
  return result;
}

/** Activates / deactivates an account. The account and its history are always kept. */
export async function setMemberActive(adminId, userId, isActive) {
  if (userId === adminId && !isActive) {
    throw new AppError("You cannot deactivate your own account", 400);
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
  });
  if (!target) throw new AppError("User not found", 404);

  if (target.isActive !== isActive) {
    await prisma.user.update({ where: { id: userId }, data: { isActive } });
    try {
      // The auth middleware caches the user: drop it so the change applies immediately.
      if (redis) await redis.del(`user:${userId}`);
    } catch {
      /* cache is best-effort */
    }

    await logActivity({
      actorId: adminId,
      action: isActive ? ACTIVITY.ACCOUNT_ACTIVATED : ACTIVITY.ACCOUNT_DEACTIVATED,
      entityType: "User",
      entityId: userId,
      metadata: { name: displayName(target), role: target.role },
    });
  }

  return { id: userId, isActive };
}

// ── Estadísticas ─────────────────────────────────────────────────────────

export async function getStats() {
  const since = new Date(Date.now() - STATS_WINDOW_DAYS * DAY_MS);

  const [visits, usages, machines, trainers, helpsByTrainer, ratingAgg, activeUsers, inactiveUsers, goals] = await Promise.all([
    prisma.gymSession.count({ where: { checkInAt: { gte: since } } }),
    prisma.machineUsage.findMany({
      where: { startedAt: { gte: since } },
      select: { machineId: true, gymSessionId: true, userId: true, startedAt: true },
      take: 50000,
    }),
    prisma.machine.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: "TRAINER", isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, trainerProfile: { select: { averageRating: true, totalRatings: true } } },
    }),
    prisma.assistance.groupBy({ by: ["trainerId"], where: { status: "COMPLETED", trainerId: { not: null } }, _count: { _all: true } }),
    prisma.trainerRating.aggregate({ _avg: { rating: true }, _count: { rating: true } }),
    prisma.user.count({ where: { role: "USER", isActive: true } }),
    prisma.user.count({ where: { role: "USER", isActive: false } }),
    prisma.goal.findMany({
      where: { active: true, user: { role: "USER", isActive: true } },
      select: { userId: true, currentValue: true, targetValue: true },
    }),
  ]);

  // Machine usage: share of the visits of the last 30 days in which the machine was used.
  const visitsByMachine = new Map();
  (usages ?? []).forEach((u) => {
    const visitKey = u.gymSessionId ?? `${u.userId}:${new Date(u.startedAt).toISOString().slice(0, 10)}`;
    if (!visitsByMachine.has(u.machineId)) visitsByMachine.set(u.machineId, new Set());
    visitsByMachine.get(u.machineId).add(visitKey);
  });

  const machineUsage = (machines ?? [])
    .map((m) => ({
      id: m.id,
      name: m.name,
      percent: visits > 0 ? Math.min(100, Math.round(((visitsByMachine.get(m.id)?.size ?? 0) / visits) * 100)) : 0,
    }))
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, "es"));

  const helpsMap = new Map((helpsByTrainer ?? []).map((h) => [h.trainerId, h._count?._all ?? 0]));
  const trainerRows = (trainers ?? [])
    .map((t) => ({
      id: t.id,
      name: displayName(t),
      rating: t.trainerProfile?.totalRatings > 0 ? Number(t.trainerProfile.averageRating.toFixed(1)) : null,
      helps: helpsMap.get(t.id) ?? 0,
    }))
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.helps - a.helps);

  // Goals: a member "meets their goals" once at least one active goal reached its target.
  const goalsByUser = new Map();
  (goals ?? []).forEach((g) => {
    const reached = g.targetValue > 0 && g.currentValue >= g.targetValue;
    goalsByUser.set(g.userId, goalsByUser.get(g.userId) || reached);
  });
  const metGoals = [...goalsByUser.values()].filter(Boolean).length;

  return {
    windowDays: STATS_WINDOW_DAYS,
    visits,
    machineUsage,
    trainers: trainerRows,
    trainersAverage: ratingAgg?._count?.rating > 0 ? Number(ratingAgg._avg.rating.toFixed(1)) : null,
    users: {
      activated: activeUsers ?? 0,
      deactivated: inactiveUsers ?? 0,
      metGoals,
      notMetGoals: goalsByUser.size - metGoals,
    },
  };
}

// ── Historial ────────────────────────────────────────────────────────────

const HISTORY_ROLES = { admin: "ADMIN", trainer: "TRAINER", user: "USER" };
const ACTOR = { id: true, firstName: true, lastName: true, email: true, role: true };

/**
 * Everything that happens in the app, newest first: what admins/trainers did
 * (ActivityLog) plus what members did (gym entries/exits, machines, help,
 * social interactions). Members who withdrew their analytics consent are left
 * out entirely — the "privado no se muestra" rule.
 */
export async function getHistory({ role, limit = 50, before } = {}) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const roleFilter = HISTORY_ROLES[role];
  const beforeDate = before ? new Date(before) : null;
  const validBefore = beforeDate && !Number.isNaN(beforeDate.getTime()) ? beforeDate : null;

  const activityWhere = {
    ...(roleFilter ? { actor: { role: roleFilter } } : {}),
    ...(validBefore ? { createdAt: { lt: validBefore } } : {}),
  };

  const includeUserEvents = !roleFilter || roleFilter === "USER" || roleFilter === "TRAINER";
  const historialWhere = {
    // Both sides of a help are stored; the trainer's row says it better ("helped X").
    NOT: { tipo: "TRAINER_ASSISTANCE", metadata: { path: ["role"], equals: "STUDENT" } },
    user: {
      ...(roleFilter ? { role: roleFilter } : {}),
      NOT: { settings: { is: { analyticsConsent: false } } },
    },
    ...(validBefore ? { occurredAt: { lt: validBefore } } : {}),
  };

  const [activity, events] = await Promise.all([
    prisma.activityLog.findMany({
      where: activityWhere,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      include: { actor: { select: ACTOR } },
    }),
    includeUserEvents
      ? prisma.historialEvento.findMany({
          where: historialWhere,
          orderBy: { occurredAt: "desc" },
          take: take + 1,
          include: { user: { select: ACTOR }, otherUser: { select: ACTOR } },
        })
      : [],
  ]);

  const rows = [
    ...(activity ?? []).map((a) => ({
      id: `a:${a.id}`,
      occurredAt: a.createdAt,
      actor: { id: a.actor.id, name: displayName(a.actor), role: a.actor.role },
      action: a.action,
      params: a.metadata ?? {},
    })),
    ...(events ?? []).map((e) => ({
      id: `h:${e.id}`,
      occurredAt: e.occurredAt,
      actor: { id: e.user.id, name: displayName(e.user), role: e.user.role },
      action: e.tipo,
      params: { ...(e.metadata ?? {}), machine: e.metadata?.machineName ?? null, other: displayName(e.otherUser) },
      _challengeId: e.tipo === "SOCIAL_INTERACTION" ? e.metadata?.challengeId ?? null : null,
    })),
  ].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

  // A social challenge is stored once per person: show it once.
  const seenChallenges = new Set();
  const deduped = rows.filter((r) => {
    if (!r._challengeId) return true;
    if (seenChallenges.has(r._challengeId)) return false;
    seenChallenges.add(r._challengeId);
    return true;
  });

  const hasMore = deduped.length > take;
  const items = deduped.slice(0, take).map(({ _challengeId, ...row }) => row);

  return {
    items,
    nextCursor: hasMore ? new Date(items[items.length - 1].occurredAt).toISOString() : null,
  };
}
