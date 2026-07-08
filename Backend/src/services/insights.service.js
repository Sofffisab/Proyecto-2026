import prisma from "../config/prisma.js";
import { shapeUserForAnalytics } from "../utils/privacy.js";

// Midpoint (in days/week) used to compare actual attendance against the
// fixed TrainingFrequency bucket the user picked in pantalla U (perfil
// mínimo). SEVEN has no upper bound to average against, so it maps to 7.
const TRAINING_FREQUENCY_TARGET_DAYS = {
  ONE_TO_TWO: 1.5,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
};

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
  const [allSessions, machineUsage, profile] = await Promise.all([
    prisma.gymSession.findMany({ 
      where: { userId },
      orderBy: { checkInAt: "desc" }
    }),
    prisma.machineUsage.findMany({ 
      where: { userId }, 
      include: { machine: true }
    }),
    // Perfil mínimo (pantalla U) — feeds the goal-adherence comparison below.
    prisma.user.findUnique({
      where: { id: userId },
      select: { objectives: true, trainingLevel: true, weeklyTrainingDays: true, trainingType: true },
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

  // Compares the user's declared weekly frequency goal (pantalla U) against
  // this week's actual check-ins. null when the user hasn't set a goal yet.
  const targetDaysPerWeek = profile?.weeklyTrainingDays
    ? TRAINING_FREQUENCY_TARGET_DAYS[profile.weeklyTrainingDays]
    : null;
  const goalProgress = targetDaysPerWeek
    ? {
        mainGoal: profile.objectives,
        trainingLevel: profile.trainingLevel,
        trainingType: profile.trainingType,
        weeklyTrainingDaysGoal: profile.weeklyTrainingDays,
        targetDaysPerWeek,
        actualDaysThisWeek: weeklySessions.length,
        onTrack: weeklySessions.length >= targetDaysPerWeek,
      }
    : null;

  return {
    total:   { sessions: allSessions.length,    minutes: totalMinutes(allSessions) },
    daily:   { sessions: dailySessions.length,   minutes: totalMinutes(dailySessions) },
    weekly:  { sessions: weeklySessions.length,  minutes: totalMinutes(weeklySessions) },
    monthly: { sessions: monthlySessions.length, minutes: totalMinutes(monthlySessions) },
    machineUsage: machinesCount,
    goalProgress,
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