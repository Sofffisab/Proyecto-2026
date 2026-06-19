import prisma from "../config/prisma.js";

export async function addProgress(userId, goalId, value) {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!goal) throw new Error("Goal not found");

  const newValue = goal.currentValue + value;
  const progressPercent = (newValue / goal.targetValue) * 100;

  await prisma.goal.update({
    where: { id: goalId },
    data: { currentValue: newValue },
  });

  return prisma.progressEntry.create({
    data: {
      userId,
      goalId,
      value,
      progressPercent,
    },
  });
}

export async function getProgressHistory(userId) {
  return prisma.progressEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Devuelve estadísticas de progreso del usuario incluyendo análisis de constancia.
 *
 * Métricas de constancia:
 *   - entriesCount         total de registros
 *   - totalProgress        suma de todos los valores
 *   - avgDaysBetweenUpdates días promedio entre actualizaciones
 *   - stdDevDays           desviación estándar de los intervalos (cuánto varía la frecuencia)
 *   - currentStreak        días consecutivos hasta hoy con al menos una entrada
 *   - longestStreak        racha más larga registrada
 *
 * @param {string} userId
 */
export async function getProgressStats(userId) {
  const entries = await prisma.progressEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (entries.length === 0) {
    return {
      totalProgress: 0,
      entriesCount: 0,
      avgDaysBetweenUpdates: null,
      stdDevDays: null,
      currentStreak: 0,
      longestStreak: 0,
    };
  }

  const total = entries.reduce((acc, e) => acc + e.value, 0);

  // ---- Intervalos entre actualizaciones (en días) ----
  const intervals = [];
  for (let i = 1; i < entries.length; i++) {
    const prev = new Date(entries[i - 1].createdAt);
    const curr = new Date(entries[i].createdAt);
    const days = (curr - prev) / (1000 * 60 * 60 * 24);
    intervals.push(days);
  }

  let avgDaysBetweenUpdates = null;
  let stdDevDays = null;

  if (intervals.length > 0) {
    avgDaysBetweenUpdates =
      intervals.reduce((a, b) => a + b, 0) / intervals.length;

    const variance =
      intervals.reduce((acc, d) => acc + Math.pow(d - avgDaysBetweenUpdates, 2), 0) /
      intervals.length;

    stdDevDays = Math.sqrt(variance);
  }

  // ---- Rachas (streak) ----
  // Agrupar entradas por fecha (YYYY-MM-DD) para contar días únicos
  const uniqueDays = [
    ...new Set(
      entries.map((e) => new Date(e.createdAt).toISOString().slice(0, 10))
    ),
  ].sort();

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 1;

  const today = new Date().toISOString().slice(0, 10);

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      streak++;
    } else {
      longestStreak = Math.max(longestStreak, streak);
      streak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, streak);

  // La racha actual solo cuenta si el último día registrado es hoy o ayer
  const lastDay = uniqueDays[uniqueDays.length - 1];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (lastDay === today || lastDay === yesterdayStr) {
    currentStreak = streak;
  } else {
    currentStreak = 0;
  }

  return {
    totalProgress: total,
    entriesCount: entries.length,
    avgDaysBetweenUpdates:
      avgDaysBetweenUpdates !== null
        ? parseFloat(avgDaysBetweenUpdates.toFixed(2))
        : null,
    stdDevDays:
      stdDevDays !== null ? parseFloat(stdDevDays.toFixed(2)) : null,
    currentStreak,
    longestStreak,
  };
}