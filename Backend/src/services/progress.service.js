import prisma from "../config/prisma.js";

export async function addProgress(userId, goalId, value) {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!goal) throw new Error("Goal not found");

  const newValue = goal.currentValue + value;

  const progressPercent =
    (newValue / goal.targetValue) * 100;

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      currentValue: newValue,
    },
  });

  return prisma.progressEntry.create({
    data: {
      userId,
      goalId,
      value,
      progressPercent,
    },
  });
}

export async function getProgressHistory(userId) {
  return prisma.progressEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProgressStats(userId) {
  const entries = await prisma.progressEntry.findMany({
    where: { userId },
  });

  const total = entries.reduce((acc, e) => acc + e.value, 0);

  return {
    totalProgress: total,
    entriesCount: entries.length,
  };
}