import prisma from "../config/prisma.js";

export async function generateWrapped(userId, year) {
  const sessions = await prisma.gymSession.findMany({
    where: { userId },
  });

  const machines = await prisma.machineUsage.findMany({
    where: { userId },
    include: { machine: true },
  });

  const points = await prisma.pointTransaction.findMany({
    where: { userId },
  });

  const payload = {
    totalSessions: sessions.length,
    totalPoints: points.reduce((a, p) => a + p.points, 0),
    machines: machines.map((m) => m.machine.name),
  };

  return prisma.wrapped.create({
    data: {
      userId,
      year,
      payload,
    },
  });
}

export async function getWrapped(userId) {
  return prisma.wrapped.findMany({
    where: { userId },
    orderBy: { year: "desc" },
  });
}