// src/services/suggestionEngine.service.js
import prisma from "../config/prisma.js";
import { createNotification } from "./notification.service.js";

/**
 * Evalúa el progreso de un usuario contra sus metas activas.
 * Si lleva más de 7 días sin actualizar o el progreso es menor al 20%,
 * genera una notificación de sugerencia.
 * @param {string} userId
 */
export async function evaluateUserProgress(userId) {
  const goals = await prisma.goal.findMany({
    where: { userId, active: true },
    include: {
      progress: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  for (const goal of goals) {
    const lastEntry = goal.progress[0];
    const now = new Date();

    const daysSinceUpdate = lastEntry
      ? Math.floor((now - new Date(lastEntry.createdAt)) / (1000 * 60 * 60 * 24))
      : null;

    const progressPercent = lastEntry ? lastEntry.progressPercent : 0;

    // Sin actualización en más de 7 días
    if (daysSinceUpdate === null || daysSinceUpdate > 7) {
      await createNotification(
        userId,
        "No olvides registrar tu progreso",
        `Llevas ${daysSinceUpdate ?? "varios"} días sin actualizar tu meta de tipo "${goal.type}". ¡Mantenete constante!`
      );
      continue;
    }

    // Progreso menor al 20% del objetivo
    if (progressPercent < 20) {
      await createNotification(
        userId,
        "Tu progreso necesita atención",
        `Tu meta de tipo "${goal.type}" está al ${progressPercent.toFixed(0)}%. Considerá ajustar tu rutina o consultar con un entrenador.`
      );
    }
  }
}

/**
 * Corre el motor de sugerencias para todos los usuarios activos.
 * Usado por el job diario.
 */
export async function runSuggestionEngineForAll() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    try {
      await evaluateUserProgress(user.id);
    } catch (err) {
      console.error(`[suggestionEngine] Failed for user ${user.id}:`, err.message);
    }
  }
}