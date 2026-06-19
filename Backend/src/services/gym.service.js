import prisma from "../config/prisma.js";
import { updateTrainerMetrics } from "./trainerMetrics.service.js";

export async function checkIn(userId) {
  return prisma.gymSession.create({
    data: {
      userId,
      checkInAt: new Date(),
    },
  });
}

export async function checkOut(userId) {
  const session = await prisma.gymSession.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });

  if (!session) throw new Error("No active session");

  const checkOutAt = new Date();
  const durationMinutes = Math.round((checkOutAt - session.checkInAt) / 60000);

  return prisma.gymSession.update({
    where: { id: session.id },
    data: { checkOutAt, durationMinutes },
  });
}

export async function getCurrentSession(userId) {
  return prisma.gymSession.findFirst({
    where: { userId, checkOutAt: null },
    orderBy: { checkInAt: "desc" },
  });
}

export async function getPresentUsers() {
  return prisma.gymSession.findMany({
    where: { checkOutAt: null },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });
}

/**
 * Califica a un trainer al finalizar una sesión.
 * Reglas:
 *   1. La sesión debe existir y pertenecer al usuario.
 *   2. La sesión debe estar finalizada (checkOutAt no null).
 *   3. Debe existir una Assistance COMPLETED que vincule al trainer
 *      con ese usuario — garantiza que la interacción fue real.
 *   4. El usuario no puede calificar al mismo trainer más de una vez
 *      por sesión.
 *
 * @param {string} sessionId
 * @param {string} userId    - Usuario que califica
 * @param {string} trainerId - Trainer a calificar
 * @param {number} rating    - Valor entre 1 y 5
 */
export async function rateTrainer(sessionId, userId, trainerId, rating) {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  // 1. Verificar que la sesión existe y pertenece al usuario
  const session = await prisma.gymSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) throw new Error("Session not found");
  if (session.userId !== userId) throw new Error("Session does not belong to this user");

  // 2. La sesión debe estar finalizada
  if (!session.checkOutAt) {
    throw new Error("Session must be completed before rating a trainer");
  }

  // 3. Verificar que existe una Assistance COMPLETED entre este trainer y este usuario
  const validAssistance = await prisma.assistance.findFirst({
    where: {
      userId,
      trainerId,
      status: "COMPLETED",
    },
  });

  if (!validAssistance) {
    throw new Error("No completed assistance found for this trainer in this session");
  }

  // 4. El usuario no puede calificar al mismo trainer dos veces en la misma sesión
  const alreadyRated = await prisma.trainerRating.findFirst({
    where: { userId, trainerId, gymSessionId: sessionId },
  });

  if (alreadyRated) {
    throw new Error("You have already rated this trainer for this session");
  }

  const trainerRating = await prisma.trainerRating.create({
    data: {
      userId,
      trainerId,
      gymSessionId: sessionId,
      rating,
    },
  });

  // Recalcular métricas del trainer con el nuevo rating
  await updateTrainerMetrics(trainerId);

  return trainerRating;
}