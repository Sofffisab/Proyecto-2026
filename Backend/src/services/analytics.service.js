import prisma from "../config/prisma.js";

/**
 * Devuelve resumen diario/semanal/mensual de actividad del usuario.
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
      prisma.machineUsage.findMany({
        where: { userId },
        include: { machine: true },
      }),
    ]);

  const totalMinutes = (sessions) =>
    sessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  const machinesCount = machineUsage.reduce((acc, m) => {
    const name = m.machine.name;
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  return {
    total: {
      sessions: allSessions.length,
      minutes: totalMinutes(allSessions),
    },
    daily: {
      sessions: dailySessions.length,
      minutes: totalMinutes(dailySessions),
    },
    weekly: {
      sessions: weeklySessions.length,
      minutes: totalMinutes(weeklySessions),
    },
    monthly: {
      sessions: monthlySessions.length,
      minutes: totalMinutes(monthlySessions),
    },
    machineUsage: machinesCount,
  };
}

export async function getGymAnalytics() {
  const sessions = await prisma.gymSession.findMany();

  return {
    totalSessions: sessions.length,
  };
}

export {
  getUserAnalytics,
  getGymAnalytics,
} from "./insights.service.js";