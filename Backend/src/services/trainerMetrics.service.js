// src/services/trainerMetrics.service.js
import prisma from "../config/prisma.js";

/**
 * Recalculates and persists trainer profile metrics:
 * total completed assistances, average rating, and total ratings count.
 * Must be called after each completeAssistance and new TrainerRating.
 * @param {string} trainerId
 */
export async function updateTrainerMetrics(trainerId) {
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

  // Upsert so the profile record is created automatically if it does not exist yet.
  await prisma.trainerProfile.upsert({
    where: { userId: trainerId },
    update: {
      averageRating,
      totalRatings,
    },
    create: {
      userId: trainerId,
      averageRating,
      totalRatings,
      specialties: ["GENERAL"], // Default fallback required by DB schema (specialties is String[])
    },
  });

  return { completedAssistances, averageRating, totalRatings };
}