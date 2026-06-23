import prisma from "../config/prisma.js";

export async function generateWrapped(userId, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const [sessions, machines, pointsAgg, assistances, socialInteractions] =
    await Promise.all([
      prisma.gymSession.findMany({
        where: { userId, checkInAt: { gte: yearStart, lt: yearEnd } },
      }),
      prisma.machineUsage.findMany({
        where: { userId, startedAt: { gte: yearStart, lt: yearEnd } },
        include: { machine: true },
      }),
      // Bug 37: use aggregate instead of findMany so individual transaction rows
      // are not loaded into memory — only the scalar sum is transferred.
      prisma.pointTransaction.aggregate({
        where: { userId, createdAt: { gte: yearStart, lt: yearEnd } },
        _sum: { points: true },
      }),
      prisma.assistance.findMany({
        where: {
          userId,
          status: "COMPLETED",
          completedAt: { gte: yearStart, lt: yearEnd },
        },
        select: { trainerId: true },
      }),
      prisma.socialInteraction.findMany({
        where: {
          userId,
          type: "CHALLENGE_COMPLETED",
          createdAt: { gte: yearStart, lt: yearEnd },
        },
      }),
    ]);

  const machineNames = machines.map((m) => m.machine.name);
  const machineCounts = machineNames.reduce((acc, name) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  // Top 3 trainers by number of assistances
  const trainerCounts = assistances.reduce((acc, a) => {
    if (a.trainerId) acc[a.trainerId] = (acc[a.trainerId] || 0) + 1;
    return acc;
  }, {});

  const topTrainerIds = Object.entries(trainerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([trainerId]) => trainerId);

  // Resolve trainer names — lookup in a single query
  const trainerProfiles = await prisma.user.findMany({
    where: { id: { in: topTrainerIds } },
    select: { id: true, firstName: true, lastName: true },
  });

  const trainerNameMap = trainerProfiles.reduce((acc, t) => {
    acc[t.id] = `${t.firstName} ${t.lastName}`;
    return acc;
  }, {});

  const topTrainers = topTrainerIds.map((trainerId) => ({
    trainerId,
    name: trainerNameMap[trainerId] ?? "Unknown",
    count: trainerCounts[trainerId],
  }));

  const payload = {
    totalSessions: sessions.length,
    totalMinutes: sessions.reduce((a, s) => a + (s.durationMinutes || 0), 0),
    totalPoints: pointsAgg._sum.points ?? 0,
    machines: Object.entries(machineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count })),
    assistancesReceived: assistances.length,
    peopleMetCount: socialInteractions.length,
    topTrainers,
  };

  return prisma.wrapped.upsert({
    where: { userId_year: { userId, year } },
    update: { payload },
    create: { userId, year, payload },
  });
}

export async function getWrapped(userId) {
  return prisma.wrapped.findMany({
    where: { userId },
    orderBy: { year: "desc" },
  });
}