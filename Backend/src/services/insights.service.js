import prisma from "../config/prisma.js";

// ============================================
// USER ANALYTICS (daily / weekly / monthly)
// ============================================

/**
 * Devuelve resumen de actividad del usuario por período.
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

  const [allSessions, dailySessions, weeklySessions, monthlySessions, machineUsage] =
    await Promise.all([
      prisma.gymSession.findMany({ where: { userId } }),
      prisma.gymSession.findMany({ where: { userId, checkInAt: { gte: startOfDay } } }),
      prisma.gymSession.findMany({ where: { userId, checkInAt: { gte: startOfWeek } } }),
      prisma.gymSession.findMany({ where: { userId, checkInAt: { gte: startOfMonth } } }),
      prisma.machineUsage.findMany({ where: { userId }, include: { machine: true } }),
    ]);

  const totalMinutes = (sessions) =>
    sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  const machinesCount = machineUsage.reduce((acc, m) => {
    const name = m.machine.name;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  return {
    total: { sessions: allSessions.length, minutes: totalMinutes(allSessions) },
    daily: { sessions: dailySessions.length, minutes: totalMinutes(dailySessions) },
    weekly: { sessions: weeklySessions.length, minutes: totalMinutes(weeklySessions) },
    monthly: { sessions: monthlySessions.length, minutes: totalMinutes(monthlySessions) },
    machineUsage: machinesCount,
  };
}

/**
 * Devuelve métricas globales del gym.
 */
export async function getGymAnalytics() {
  const [totalSessions, activeUsers] = await Promise.all([
    prisma.gymSession.count(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return { totalSessions, activeUsers };
}

// ============================================
// WRAPPED (resumen anual)
// ============================================

/**
 * Genera y persiste el wrapped anual de un usuario.
 * @param {string} userId
 * @param {number} year
 */
export async function generateWrapped(userId, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const [sessions, machines, points] = await Promise.all([
    prisma.gymSession.findMany({
      where: { userId, checkInAt: { gte: yearStart, lt: yearEnd } },
    }),
    prisma.machineUsage.findMany({
      where: { userId, startedAt: { gte: yearStart, lt: yearEnd } },
      include: { machine: true },
    }),
    prisma.pointTransaction.findMany({
      where: { userId, createdAt: { gte: yearStart, lt: yearEnd } },
    }),
  ]);

  const machineNames = machines.map((m) => m.machine.name);
  const machineCounts = machineNames.reduce((acc, name) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  const payload = {
    totalSessions: sessions.length,
    totalMinutes: sessions.reduce((a, s) => a + (s.durationMinutes || 0), 0),
    totalPoints: points.reduce((a, p) => a + p.points, 0),
    topMachines: Object.entries(machineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count })),
  };

  return prisma.wrapped.upsert({
    where: { userId_year: { userId, year } },
    update: { payload },
    create: { userId, year, payload },
  });
}

export async function getWrapped(userId) {
  return prisma.wrapped.findMany({
    where: { userId },
    orderBy: { year: "desc" },
  });
}