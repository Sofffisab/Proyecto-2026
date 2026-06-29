import prisma from "../config/prisma.js";

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