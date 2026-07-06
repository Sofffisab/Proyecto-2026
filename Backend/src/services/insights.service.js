import prisma from "../config/prisma.js";
import { shapeUserForAnalytics } from "../utils/privacy.js";

// ============================================
// USER ANALYTICS (daily / weekly / monthly)
// ============================================

/**
 * Returns user activity summary by period.
 * Performs a single query for all sessions and filters them in-memory
 * to prevent executing 4 identical queries against the database.
 * @param {string} userId
 */
export async function getUserAnalytics(userId) {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Single query for all user sessions + machine usage, filter in memory
  const [allSessions, machineUsage] = await Promise.all([
    prisma.gymSession.findMany({ 
      where: { userId },
      orderBy: { checkInAt: "desc" }
    }),
    prisma.machineUsage.findMany({ 
      where: { userId }, 
      include: { machine: true }
    }),
  ]);

  // Filter in memory by date
  const dailySessions = allSessions.filter(s => s.checkInAt >= startOfDay);
  const weeklySessions = allSessions.filter(s => s.checkInAt >= startOfWeek);
  const monthlySessions = allSessions.filter(s => s.checkInAt >= startOfMonth);

  const totalMinutes = (sessions) =>
    sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  const machinesCount = machineUsage.reduce((acc, m) => {
    const name = m.machine.name;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  return {
    total:   { sessions: allSessions.length,    minutes: totalMinutes(allSessions) },
    daily:   { sessions: dailySessions.length,   minutes: totalMinutes(dailySessions) },
    weekly:  { sessions: weeklySessions.length,  minutes: totalMinutes(weeklySessions) },
    monthly: { sessions: monthlySessions.length, minutes: totalMinutes(monthlySessions) },
    machineUsage: machinesCount,
  };
}

/**
 * Returns global gym metrics.
 */
export async function getGymAnalytics() {
  const [totalSessions, activeUsers] = await Promise.all([
    prisma.gymSession.count(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return { totalSessions, activeUsers };
}

// ============================================================================
// ADMIN: full user history/analytics export.
//
// This is the endpoint referenced in the "privacy filters on full history"
// requirement: every row goes through shapeUserForAnalytics(), which is the
// abstraction/pseudonymization layer that keeps this legal to use for
// operational analytics without exposing every user's identity by default,
// and fully honors a user's withdrawn consent (settings.analyticsConsent).
//
// - includeIdentifiers=false (default): every row is fully pseudonymous —
//   no name/email at all, only a stable pseudoId, regardless of consent.
// - includeIdentifiers=true: real name/email are attached ONLY for users who
//   have not withdrawn consent. Users with analyticsConsent=false are still
//   returned (their activity counts for gym-wide stats) but always
//   pseudonymized — this is enforced inside shapeUserForAnalytics and cannot
//   be bypassed by the caller.
// ============================================================================
export async function getFullHistoryAdmin({ includeIdentifiers = false } = {}) {
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      settings: { select: { analyticsConsent: true } },
      gymSessions: {
        select: { id: true, checkInAt: true, checkOutAt: true, durationMinutes: true },
        orderBy: { checkInAt: "desc" },
      },
      machineUsages: {
        select: { id: true, startedAt: true, endedAt: true, durationMinutes: true, machine: { select: { name: true, zone: true } } },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  return users.map((user) => {
    const identity = shapeUserForAnalytics(user, { includeIdentifiers });

    return {
      ...identity,
      totalSessions: user.gymSessions.length,
      totalMinutes: user.gymSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0),
      sessions: user.gymSessions,
      machineUsages: user.machineUsages,
    };
  });
}