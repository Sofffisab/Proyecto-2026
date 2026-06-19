// src/services/trainerMetrics.service.js
import prisma from "../config/prisma.js";

/**
 * Recalcula y persiste las métricas del perfil del trainer:
 * total de asistencias completadas, promedio de rating y total de ratings.
 * Debe llamarse después de cada completeAssistance y cada nuevo TrainerRating.
 * @param {string} trainerId
 */
export async function updateTrainerMetrics(trainerId) {
  const [completedAssistances, ratings] = await Promise.all([
    prisma.assistance.count({
      where: { trainerId, status: "COMPLETED" },
    }),
    prisma.trainerRating.findMany({
      where: { trainerId },
      select: { rating: true },
    }),
  ]);

  const totalRatings = ratings.length;
  const averageRating =
    totalRatings > 0
      ? ratings.reduce((acc, r) => acc + r.rating, 0) / totalRatings
      : 0;

  await prisma.trainerProfile.update({
    where: { userId: trainerId },
    data: {
      averageRating,
      totalRatings,
    },
  });

  return { completedAssistances, averageRating, totalRatings };
}