import prisma from "../config/prisma.js";
import { completeChallengeByQR } from "./challenge.service.js";

export async function scan(scannerId, targetId, type) {
  if (type === "USER") {
    const challenge = await prisma.socialChallenge.findFirst({
      where: {
        OR: [
          { userId: scannerId, partnerUserId: targetId },
          { userId: targetId, partnerUserId: scannerId },
        ],
        status: "ACCEPTED",
      },
    });

    if (!challenge) {
      throw new Error(
        "No active accepted challenge found between these users"
      );
    }

    await completeChallengeByQR(challenge.id, scannerId, targetId);

    return { success: true, message: "Challenge completed via QR scan" };
  }

  if (type === "MACHINE") {
    const activeSession = await prisma.gymSession.findFirst({
      where: { userId: scannerId, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    if (!activeSession) {
      throw new Error("User has no active gym session");
    }

    const machine = await prisma.machine.findUnique({
      where: { id: targetId },
    });

    if (!machine || !machine.active) {
      throw new Error("Machine not found or inactive");
    }

    await prisma.machineUsage.create({
      data: {
        userId: scannerId,
        machineId: targetId,
        gymSessionId: activeSession.id,
        startedAt: new Date(),
      },
    });

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