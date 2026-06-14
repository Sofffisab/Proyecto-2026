import prisma from "../config/prisma.js";

export async function checkIn(userId) {
  const session = await prisma.gymSession.create({
    data: {
      userId,
      checkInAt: new Date(),
    },
  });

  return session;
}

export async function checkOut(userId) {
  const session = await prisma.gymSession.findFirst({
    where: {
      userId,
      checkOutAt: null,
    },
    orderBy: {
      checkInAt: "desc",
    },
  });

  if (!session) {
    throw new Error("No active session");
  }

  const checkOutAt = new Date();

  const duration =
    (checkOutAt - session.checkInAt) / 60000;

  return prisma.gymSession.update({
    where: { id: session.id },
    data: {
      checkOutAt,
      durationMinutes: Math.round(duration),
    },
  });
}

export async function getCurrentSession(userId) {
  return prisma.gymSession.findFirst({
    where: {
      userId,
      checkOutAt: null,
    },
    orderBy: {
      checkInAt: "desc",
    },
  });
}