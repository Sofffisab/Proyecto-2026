import prisma from "../config/prisma.js";

export async function scan(userId, targetId, type) {
  // type: USER | MACHINE | SOCIAL

  if (type === "USER") {
    const isValidChallenge =
      await prisma.socialChallenge.findFirst({
        where: {
          OR: [
            { userId, partnerUserId: targetId },
            { userId: targetId, partnerUserId: userId },
          ],
          status: "ACCEPTED",
        },
      });

    if (!isValidChallenge) {
      throw new Error("Invalid transaction");
    }

    await prisma.socialInteraction.create({
      data: {
        userId,
        targetUserId: targetId,
        type: "SOCIAL_SCAN",
      },
    });

    return { success: true, message: "Social interaction completed" };
  }

  if (type === "MACHINE") {
    return { success: true, message: "Machine scan registered" };
  }

  if (type === "ENTRY_EXIT") {
    return { success: true, message: "Check-in/out processed in gym service" };
  }

  throw new Error("Invalid QR type");
}

export async function getMyQR(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });
}