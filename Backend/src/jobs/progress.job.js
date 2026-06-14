import prisma from "../config/prisma.js";

/**
 * Detecta usuarios sin progreso reciente
 */
export async function checkInactiveProgress() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    const lastProgress = await prisma.progressEntry.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!lastProgress) {
      console.log(`User ${user.id} has no progress`);
    }

    // futuro: notificación automática
  }
}