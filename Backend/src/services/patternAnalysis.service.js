import prisma from "../config/prisma.js";
import { createNotification } from "./communication.service.js";

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
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCount = {};
  for (const session of sessions) {
    const day = new Date(session.checkInAt).getDay();
    dayCount[day] = (dayCount[day] || 0) + 1;
  }

  const frequentDays = Object.entries(dayCount)
    .map(([day, count]) => ({ day: Number(day), name: dayNames[Number(day)], count }))
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
 * Corre el análisis de patrones para todos los usuarios activos,
 * persiste los resultados en la tabla UserPatternSnapshot (si existe)
 * y envía una notificación in-app con el resumen al usuario.
 */
export async function runPatternAnalysisForAll() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    try {
      const patterns = await analyzeUserPatterns(user.id);

      if (patterns.sessionCount === 0) continue;

      // Persist snapshot — tries to upsert into UserPatternSnapshot if the table exists.
      await prisma.userPatternSnapshot
        .upsert({
          where: { userId: user.id },
          update: { payload: patterns, updatedAt: new Date() },
          create: { userId: user.id, payload: patterns },
        })
        .catch(() => {
          // Table may not exist yet in all environments; log but don't abort.
          console.log(
            `[patternAnalysis] Snapshot not persisted for ${user.id} (table absent)`
          );
        });

      // Notify the user with their top training day and machine
      const topDay = patterns.frequentDays[0];
      const topMachine = patterns.topMachines[0];

      if (topDay || topMachine) {
        const parts = [];
        if (topDay) parts.push(`Your favourite training day is ${topDay.name}`);
        if (topMachine) parts.push(`your most-used machine is ${topMachine.name}`);

        await createNotification(
          user.id,
          "Your training patterns this week",
          parts.join(" and ") + "."
        );
      }
    } catch (err) {
      console.error(`[patternAnalysis] Failed for user ${user.id}:`, err.message);
    }
  }
}