import prisma from "../config/prisma.js";
import { shapeUserForAnalytics } from "../utils/privacy.js";

// Midpoint days/week per TrainingFrequency bucket (declared vs actual attendance)
const TRAINING_FREQUENCY_TARGET_DAYS = {
  ONE_TO_TWO: 1.5,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
  SIX: 6,
  SEVEN: 7,
};

// USER ANALYTICS (daily / weekly / monthly)

/** User activity summary by period (day/week/month), computed from a single query. */
export async function getUserAnalytics(userId) {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Single query, then filter in memory (avoids 4 near-identical queries)
  const [allSessions, machineUsage, profile] = await Promise.all([
    prisma.gymSession.findMany({ 
      where: { userId },
      orderBy: { checkInAt: "desc" }
    }),
    prisma.machineUsage.findMany({ 
      where: { userId }, 
      include: { machine: true }
    }),
    // Feeds the goal-adherence comparison below
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

  // Declared weekly frequency goal vs actual check-ins this week (null if no goal set)
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

/** Global gym metrics. */
export async function getGymAnalytics() {
  const [
    totalSessions,
    activeUsers,
    inactiveUsers,
    machines,
    machineUsageCounts,
    trainerProfiles,
    activeGoals,
  ] = await Promise.all([
    prisma.gymSession.count(),
    prisma.user.count({ where: { isActive: true, role: "USER" } }),
    prisma.user.count({ where: { isActive: false, role: "USER" } }),
    prisma.machine.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.machineUsage.groupBy({ by: ["machineId"], _count: { _all: true } }),
    prisma.trainerProfile.findMany({ select: { averageRating: true, totalRatings: true } }),
    prisma.goal.findMany({
      where: { active: true },
      select: { action: true, targetValue: true, currentValue: true },
    }),
  ]);

  // Section "Generales del gym": % of total machine-usage events per machine.
  const totalMachineUsages = machineUsageCounts.reduce((sum, m) => sum + m._count._all, 0);
  const usageByMachineId = machineUsageCounts.reduce((acc, m) => {
    acc[m.machineId] = m._count._all;
    return acc;
  }, {});
  const machineUsagePercentages = machines.map((m) => ({
    machineId: m.id,
    machineName: m.name,
    usageCount: usageByMachineId[m.id] ?? 0,
    percentage: totalMachineUsages > 0 ? ((usageByMachineId[m.id] ?? 0) / totalMachineUsages) * 100 : 0,
  }));

  // Section "Entrenadores": average rating across all rated trainers.
  const ratedTrainers = trainerProfiles.filter((tp) => tp.totalRatings > 0);
  const averageTrainerRating = ratedTrainers.length > 0
    ? ratedTrainers.reduce((sum, tp) => sum + tp.averageRating, 0) / ratedTrainers.length
    : 0;

  // Section "Usuarios": how many currently meet their active goal(s).
  // LOSE goals count as met once currentValue drops to/under target;
  // GAIN/MAINTAIN goals count as met once currentValue reaches/exceeds target.
  let goalsMet = 0;
  let goalsNotMet = 0;
  activeGoals.forEach((g) => {
    const met = g.action === "LOSE" ? g.currentValue <= g.targetValue : g.currentValue >= g.targetValue;
    if (met) goalsMet += 1;
    else goalsNotMet += 1;
  });

  return {
    totalSessions,
    activeUsers,
    inactiveUsers,
    machineUsagePercentages,
    trainerCount: trainerProfiles.length,
    averageTrainerRating,
    goalsMet,
    goalsNotMet,
  };
}

// ADMIN: full user history/analytics export. Every row is pseudonymized via
// shapeUserForAnalytics(), honoring analyticsConsent.
// - includeIdentifiers=false (default): always pseudonymous (stable pseudoId only)
// - includeIdentifiers=true: real name/email attached only if consent wasn't withdrawn
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