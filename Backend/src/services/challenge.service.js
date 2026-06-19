import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { POINTS } from "../constants/points.js";

/**
 * @param {string} userIdA - Primer participante
 * @param {string} userIdB - Segundo participante
 * @param {string} [station] - Estación o máquina donde se lleva a cabo
 */
export async function assignChallenge(userIdA, userIdB, station) {
  // Verificar que ninguno de los dos tenga los desafíos sociales desactivados
  const [settingsA, settingsB] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId: userIdA } }),
    prisma.userSettings.findUnique({ where: { userId: userIdB } }),
  ]);

  if (settingsA?.disableSocial || settingsB?.disableSocial) {
    throw new Error("One or both users have social challenges disabled");
  }

  // No crear un desafío duplicado si ya hay uno activo entre estos dos
  const existing = await prisma.socialChallenge.findFirst({
    where: {
      OR: [
        { userId: userIdA, partnerUserId: userIdB },
        { userId: userIdB, partnerUserId: userIdA },
      ],
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
  });

  if (existing) {
    throw new Error("An active challenge already exists between these users");
  }

  return prisma.socialChallenge.create({
    data: {
      userId: userIdA,
      partnerUserId: userIdB,
      station,
      status: "ASSIGNED",
      // Expira en 24 horas si ninguno actúa
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
}

/**
 * Un participante acepta el desafío asignado por la app.
 * Cualquiera de los dos puede aceptar primero.
 * @param {string} challengeId
 * @param {string} callerId - ID del usuario que acepta
 */
export async function acceptChallenge(challengeId, callerId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) throw new Error("Challenge not found");

    if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
      throw new Error("Not a participant of this challenge");
    }

    if (challenge.status !== "ASSIGNED") {
      throw new Error(`Cannot accept a challenge with status: ${challenge.status}`);
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "ACCEPTED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: callerId,
        targetUserId:
          callerId === challenge.userId
            ? challenge.partnerUserId
            : challenge.userId,
        type: "CHALLENGE_ACCEPTED",
      },
    });

    return updated;
  });
}

/**
 * Un participante rechaza el desafío.
 * @param {string} challengeId
 * @param {string} callerId
 */
export async function rejectChallenge(challengeId, callerId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) throw new Error("Challenge not found");

    if (challenge.userId !== callerId && challenge.partnerUserId !== callerId) {
      throw new Error("Not a participant of this challenge");
    }

    if (!["ASSIGNED", "ACCEPTED"].includes(challenge.status)) {
      throw new Error(`Cannot reject a challenge with status: ${challenge.status}`);
    }

    // Si rechaza habiendo aceptado previamente, el que aceptó igual recibe puntos
    // por haber intentado (ver constants/points.js SOCIAL_CHALLENGE_ATTEMPTED)
    if (challenge.status === "ACCEPTED") {
      const participantWhoAccepted =
        callerId === challenge.userId
          ? challenge.partnerUserId
          : challenge.userId;

      await addPoints(
        participantWhoAccepted,
        POINTS.SOCIAL_CHALLENGE_ATTEMPTED,
        "Social challenge attempted (partner rejected)"
      );
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "REJECTED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: callerId,
        targetUserId:
          callerId === challenge.userId
            ? challenge.partnerUserId
            : challenge.userId,
        type: "CHALLENGE_REJECTED",
      },
    });

    return updated;
  });
}

/**
 * Completa el desafío mediante escaneo QR mutuo.
 * El flujo es: usuario A escanea el QR de usuario B (o viceversa).
 * Esto se llama desde qr.service.js cuando se detecta un scan de tipo SOCIAL.
 * Ambos participantes reciben puntos completos.
 * @param {string} challengeId
 * @param {string} scannerId - Quien escanea
 * @param {string} scannedId - Cuyo QR fue escaneado
 */
export async function completeChallengeByQR(challengeId, scannerId, scannedId) {
  return prisma.$transaction(async (tx) => {
    const challenge = await tx.socialChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) throw new Error("Challenge not found");

    // Ambos deben ser participantes
    const participantIds = [challenge.userId, challenge.partnerUserId];
    if (!participantIds.includes(scannerId) || !participantIds.includes(scannedId)) {
      throw new Error("Both users must be participants of this challenge");
    }

    if (challenge.status !== "ACCEPTED") {
      throw new Error("Challenge must be in ACCEPTED status to be completed");
    }

    const updated = await tx.socialChallenge.update({
      where: { id: challengeId },
      data: { status: "COMPLETED" },
    });

    await tx.socialInteraction.create({
      data: {
        userId: scannerId,
        targetUserId: scannedId,
        type: "CHALLENGE_COMPLETED",
      },
    });

    // Ambos participantes reciben puntos completos
    await addPoints(
      challenge.userId,
      POINTS.SOCIAL_CHALLENGE_COMPLETED,
      "Social challenge completed"
    );
    await addPoints(
      challenge.partnerUserId,
      POINTS.SOCIAL_CHALLENGE_COMPLETED,
      "Social challenge completed"
    );

    return updated;
  });
}

/**
 * Devuelve los desafíos activos (ASSIGNED o ACCEPTED) de un usuario.
 * @param {string} userId
 */
export async function getActiveChallenges(userId) {
  return prisma.socialChallenge.findMany({
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Devuelve el historial completo de desafíos de un usuario.
 * @param {string} userId
 */
export async function getChallengeHistory(userId) {
  return prisma.socialChallenge.findMany({
    where: {
      OR: [{ userId }, { partnerUserId: userId }],
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      partner: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}