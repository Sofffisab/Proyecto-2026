import prisma from "../config/prisma.js";

/**
 * Registra una transacción de puntos y verifica automáticamente si
 * el usuario cruzó algún umbral de logro (milestone).
 * @param {string} userId
 * @param {number} points
 * @param {string} reason
 */
export async function addPoints(userId, points, reason) {
  const transaction = await prisma.pointTransaction.create({
    data: { userId, points, reason },
  });

  // Verificar logros automáticamente después de cada suma de puntos
  await checkAndUnlockAchievements(userId);

  return transaction;
}

export async function getPoints(userId) {
  const transactions = await prisma.pointTransaction.findMany({
    where: { userId },
  });

  const total = transactions.reduce((acc, t) => acc + t.points, 0);

  return { totalPoints: total, transactions };
}

/**
 * Verifica si el usuario cruzó algún umbral de Achievement y lo desbloquea
 * automáticamente si aún no lo tiene. Se llama tras cada addPoints.
 * @param {string} userId
 */
export async function checkAndUnlockAchievements(userId) {
  // Total de puntos actuales
  const transactions = await prisma.pointTransaction.findMany({
    where: { userId },
    select: { points: true },
  });
  const totalPoints = transactions.reduce((acc, t) => acc + t.points, 0);

  // Logros que el usuario todavía no tiene
  const unlockedIds = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true },
  });
  const unlockedSet = new Set(unlockedIds.map((u) => u.achievementId));

  // Achievements cuyo umbral ya se cruzó
  const eligible = await prisma.achievement.findMany({
    where: { pointsRequired: { lte: totalPoints } },
  });

  for (const achievement of eligible) {
    if (unlockedSet.has(achievement.id)) continue;

    // Desbloquear en transacción atómica
    await prisma.$transaction(async (tx) => {
      await tx.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });

      // Bonus de puntos por desbloquear el logro
      await tx.pointTransaction.create({
        data: {
          userId,
          points: 50,
          reason: `Achievement unlocked: ${achievement.name}`,
        },
      });
    });
  }
}

/**
 * Desbloquea un achievement específico manualmente (admin/system use).
 * Wrapped in a transaction: both the achievement record and the
 * points reward are created atomically.
 */
export async function unlockAchievement(userId, achievementId) {
  return prisma.$transaction(async (tx) => {
    const achievement = await tx.achievement.findUnique({
      where: { id: achievementId },
    });

    if (!achievement) throw new Error("Achievement not found");

    const existing = await tx.userAchievement.findFirst({
      where: { userId, achievementId },
    });

    if (existing) throw new Error("Achievement already unlocked");

    const userAchievement = await tx.userAchievement.create({
      data: { userId, achievementId },
    });

    await tx.pointTransaction.create({
      data: {
        userId,
        points: 50,
        reason: `Achievement unlocked: ${achievement.name}`,
      },
    });

    return userAchievement;
  });
}

export async function getAchievements(userId) {
  return prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });
}