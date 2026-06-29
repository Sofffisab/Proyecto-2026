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

  // Error 27 Fix: Changed .update() to .upsert() to automatically create 
  // the profile record if it doesn't already exist for the user.
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
      specialty: "GENERAL", // Default fallback required by DB schemas
    },
  });

  return { completedAssistances, averageRating, totalRatings };
}