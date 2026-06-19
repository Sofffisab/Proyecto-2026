import prisma from "../config/prisma.js";
import { addPoints, checkAndUnlockAchievements, getPoints, getAchievements } from "./gamification.service.js";
import { generateReward, approveReward, shipReward, deliverReward } from "./reward.service.js";
import { POINTS } from "../constants/points.js";

// ============================================
// POINTS
// ============================================
export { addPoints, getPoints };

// ============================================
// ACHIEVEMENTS
// ============================================
export { getAchievements, checkAndUnlockAchievements };

/**
 * Devuelve todos los achievements disponibles en el sistema.
 */
export async function getAllAchievements() {
  return prisma.achievement.findMany({ orderBy: { pointsRequired: "asc" } });
}

// ============================================
// REWARDS
// ============================================
export { generateReward, approveReward, shipReward, deliverReward };

/**
 * Canjea una recompensa validando que el usuario tenga puntos suficientes.
 * @param {string} userId
 * @param {string} rewardId
 */
export async function redeemReward(userId, rewardId) {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward) throw new Error("Reward not found");

  const { totalPoints } = await getPoints(userId);
  if (totalPoints < reward.pointsCost) {
    throw new Error(`Not enough points. Required: ${reward.pointsCost}, available: ${totalPoints}`);
  }

  // Descontar puntos y crear la redención en una transacción atómica
  return prisma.$transaction(async (tx) => {
    await tx.pointTransaction.create({
      data: {
        userId,
        points: -reward.pointsCost,
        reason: `Reward redeemed: ${reward.name}`,
      },
    });

    return tx.rewardRedemption.create({
      data: { userId, rewardId, status: "PENDING" },
    });
  });
}

// ============================================
// LEADERBOARD
// ============================================

/**
 * Devuelve los top N usuarios por puntos totales.
 * @param {number} limit
 */
export async function getLeaderboard(limit = 20) {
  const transactions = await prisma.pointTransaction.groupBy({
    by: ["userId"],
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: limit,
  });

  return transactions.map((t) => ({
    userId: t.userId,
    totalPoints: t._sum.points ?? 0,
  }));
}