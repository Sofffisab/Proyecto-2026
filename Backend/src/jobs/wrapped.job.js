import prisma from "../config/prisma.js";

/**
 * Genera Wrapped anual automáticamente
 */
export async function generateAnnualWrapped(year) {
  const users = await prisma.user.findMany();

  for (const user of users) {
    const sessions = await prisma.gymSession.findMany({
      where: { userId: user.id },
    });

    const points = await prisma.pointTransaction.findMany({
      where: { userId: user.id },
    });

    const payload = {
      totalSessions: sessions.length,
      totalPoints: points.reduce((a, p) => a + p.points, 0),
    };

    await prisma.wrapped.create({
      data: {
        userId: user.id,
        year,
        payload,
      },
    });
  }
}