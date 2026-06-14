import prisma from "../config/prisma.js";

/**
 * Recalcula puntos derivados (si en el futuro querés consistencia)
 * Por ahora solo placeholder porque la fuente real es PointTransaction
 */
export async function recalculatePoints() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    const transactions = await prisma.pointTransaction.findMany({
      where: { userId: user.id },
    });

    const total = transactions.reduce(
      (acc, t) => acc + t.points,
      0
    );

    // Placeholder: acá podrías cachear en Redis o tabla denormalizada
    console.log(`User ${user.id} points: ${total}`);
  }
}