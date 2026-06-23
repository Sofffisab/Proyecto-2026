// src/services/trainerMetrics.service.js
import prisma from "../config/prisma.js";

/**
 * Recalcula y persiste las métricas del perfil del trainer:
 * total de asistencias completadas, promedio de rating y total de ratings.
 * Debe llamarse después de cada completeAssistance y cada nuevo TrainerRating.
 * @param {string} trainerId
 */
export async function updateTrainerMetrics(trainerId) {
  // Bug 27: use aggregate instead of findMany so only summary values are
  // transferred from the DB — avoids loading every TrainerRating row into memory.
  const [completedAssistances, ratingsAgg] = await Promise.all([
    prisma.assistance.count({
      where: { trainerId, status: "COMPLETED" },
    }),
    prisma.trainerRating.aggregate({
      where: { trainerId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  const totalRatings = ratingsAgg._count.rating;
  const averageRating = ratingsAgg._avg.rating ?? 0;

  await prisma.trainerProfile.update({
    where: { userId: trainerId },
    data: {
      averageRating,
      totalRatings,
    },
  });

  return { completedAssistances, averageRating, totalRatings };
}