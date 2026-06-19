import prisma from "../config/prisma.js";
import { completeChallengeByQR } from "./challenge.service.js";

/**
 * Procesa el escaneo de un QR.
 * @param {string} scannerId - Usuario que escanea
 * @param {string} targetId  - ID del target (usuario, máquina, etc.)
 * @param {string} type      - "USER" | "MACHINE" | "ENTRY_EXIT"
 */
export async function scan(scannerId, targetId, type) {
  if (type === "USER") {
    // Buscar un desafío activo (ACCEPTED) entre los dos usuarios
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
    return { success: true, message: "Machine scan registered" };
  }

  if (type === "ENTRY_EXIT") {
    return { success: true, message: "Check-in/out processed in gym service" };
  }

  throw new Error("Invalid QR type");
}

/**
 * @param {string} userId
 */
export async function getMyQR(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
    },
  });
}


export {
  getUserQR,
  regenerateMachineQR,
  validateQRPayload,
  processScan as scan,
} from "./verification.service.js";