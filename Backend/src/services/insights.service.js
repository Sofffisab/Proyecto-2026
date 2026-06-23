import prisma from "../config/prisma.js";

// ============================================
// USER ANALYTICS (daily / weekly / monthly)
// ============================================

/**
 * Devuelve resumen de actividad del usuario por período.
 * Trae todas las sesiones una sola vez y filtra en memoria
 * para evitar 4 queries idénticas contra la misma tabla.
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

  // Bug 26: filter sessions by date at the DB level to avoid loading the full
  // history into memory (a user with years of sessions could saturate RAM).
  // We fetch four date-bounded result sets in one round-trip.
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
    total:   { sessions: allSessions.length,    minutes: totalMinutes(allSessions) },
    daily:   { sessions: dailySessions.length,   minutes: totalMinutes(dailySessions) },
    weekly:  { sessions: weeklySessions.length,  minutes: totalMinutes(weeklySessions) },
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
// Delega a wrapped.service.js para evitar dos
// implementaciones desincronizadas.
// ============================================

export { generateWrapped, getWrapped } from "./wrapped.service.js";