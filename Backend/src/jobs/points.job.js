import prisma from "../config/prisma.js";

/**
 * Recalcula puntos derivados (si en el futuro querés consistencia)
 * Por ahora solo placeholder porque la fuente real es PointTransaction.
 */
export async function recalculatePoints() {
  let users;

  try {
    users = await prisma.user.findMany();
  } catch (err) {
    console.error("[points.job] Failed to fetch users:", err.message);
    throw err;
  }

  for (const user of users) {
    try {
      const transactions = await prisma.pointTransaction.findMany({
        where: { userId: user.id },
      });

      const total = transactions.reduce(
        (acc, t) => acc + t.points,
        0
      );

      // Placeholder: acá podrías cachear en Redis o tabla denormalizada
      console.log(`[points.job] User ${user.id} points: ${total}`);
    } catch (err) {
      console.error(`[points.job] Failed to process user ${user.id}:`, err.message);
      // Continue with next user instead of aborting the whole job
    }
  }
}