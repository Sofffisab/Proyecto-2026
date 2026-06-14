import prisma from "../config/prisma.js";

export async function getUserAnalytics(userId) {
  const sessions = await prisma.gymSession.findMany({
    where: { userId },
  });

  const machineUsage = await prisma.machineUsage.findMany({
    where: { userId },
    include: { machine: true },
  });

  const totalTime = sessions.reduce(
    (acc, s) => acc + (s.durationMinutes || 0),
    0
  );

  const machinesCount = machineUsage.reduce((acc, m) => {
    acc[m.machine.name] = (acc[m.machine.name] || 0) + 1;
    return acc;
  }, {});

  return {
    totalSessions: sessions.length,
    totalMinutes: totalTime,
    machineUsage: machinesCount,
  };
}

export async function getGymAnalytics() {
  const sessions = await prisma.gymSession.findMany();

  return {
    totalSessions: sessions.length,
  };
}