// src/services/patternAnalysis.service.js
import prisma from "../config/prisma.js";

/**
 * Analiza los patrones de entrenamiento de un usuario:
 * días más frecuentes, máquinas más usadas y secuencias de sesiones.
 * @param {string} userId
 * @returns {{ frequentDays: object[], topMachines: object[], sessionCount: number }}
 */
export async function analyzeUserPatterns(userId) {
  const sessions = await prisma.gymSession.findMany({
    where: { userId },
    include: { machineUsages: { include: { machine: true } } },
    orderBy: { checkInAt: "asc" },
  });

  // Frecuencia por día de la semana (0 = domingo, 6 = sábado)
  const dayCount = {};
  for (const session of sessions) {
    const day = new Date(session.checkInAt).getDay();
    dayCount[day] = (dayCount[day] || 0) + 1;
  }

  const frequentDays = Object.entries(dayCount)
    .map(([day, count]) => ({ day: Number(day), count }))
    .sort((a, b) => b.count - a.count);

  // Máquinas más usadas
  const machineCount = {};
  for (const session of sessions) {
    for (const usage of session.machineUsages) {
      const name = usage.machine.name;
      machineCount[name] = (machineCount[name] || 0) + 1;
    }
  }

  const topMachines = Object.entries(machineCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    sessionCount: sessions.length,
    frequentDays,
    topMachines,
  };
}

/**
 * Corre el análisis de patrones para todos los usuarios activos.
 * Usado por el job semanal.
 */
export async function runPatternAnalysisForAll() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    try {
      const patterns = await analyzeUserPatterns(user.id);
      console.log(`[patternAnalysis] User ${user.id}:`, patterns);
      // futuro: guardar en tabla analytics_snapshot o notificar al usuario
    } catch (err) {
      console.error(`[patternAnalysis] Failed for user ${user.id}:`, err.message);
    }
  }
}