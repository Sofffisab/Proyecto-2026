import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { computeProgressPoints } from "./scoringEngine.service.js";

export async function addProgress(userId, goalId, value) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) throw new Error("Goal not found");

  if (goal.userId !== userId) {
    throw new Error("Forbidden: goal does not belong to this user");
  }

  const previousPercent = goal.targetValue > 0
    ? (goal.currentValue / goal.targetValue) * 100
    : 0;

  const newValue = goal.currentValue + value;
  const progressPercent = goal.targetValue > 0
    ? (newValue / goal.targetValue) * 100
    : 0;

  await prisma.goal.update({
    where: { id: goalId },
    data: { currentValue: newValue },
  });

  const entry = await prisma.progressEntry.create({
    data: { userId, goalId, value, progressPercent },
  });

  // Points now depend on: how much % this update covered, the standardized
  // difficulty for this goal type/action/target, and the user's personal
  // behavior pattern — see scoringEngine.service.js.
  const { points: pointsToAward, breakdown } = await computeProgressPoints(userId, goal, {
    previousPercent,
    newPercent: progressPercent,
  });

  addPoints(
    userId,
    pointsToAward,
    `Progress update (${goal.type}/${goal.action}, difficulty x${breakdown.difficultyScore}, +${breakdown.deltaPercent}%)`
  ).catch((err) => console.error("[progress] Failed to award points:", err.message));

  return entry;
}

export async function getProgressHistory(userId, filters = {}) {
  const { metric, startDate, endDate, limit = 20, offset = 0 } = filters;

  const where = { userId };
  if (metric) where.metric = metric;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = startDate;
    if (endDate) where.date.lte = endDate;
  }

  return prisma.progressLog.findMany({
    where,
    orderBy: { date: "desc" },
    take: limit,
    skip: offset,
  });
}

// ============================================
// Progress logs (metric time series) — addProgressLog / streaks
// ============================================

export async function addProgressLog(userId, { metric, value }, options = {}) {
  const { force } = options;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!force) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await prisma.progressLog.findFirst({
      where: { userId, metric, date: { gte: today, lt: tomorrow } },
    });

    if (existing) throw new Error("Already logged today");

    return prisma.progressLog.create({
      data: { userId, metric, value, date: new Date() },
    });
  }

  return prisma.progressLog.upsert({
    where: { userId_metric_date: { userId, metric, date: today } },
    update: { value },
    create: { userId, metric, value, date: today },
  });
}

export async function getCurrentStreak(userId, metric) {
  const logs = await prisma.progressLog.findMany({
    where: { userId, metric },
    orderBy: { date: "desc" },
  });

  if (!logs || !logs.length) return 0;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const dayStart = (d) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };

  const dates = [...new Set(logs.map((l) => dayStart(l.date)))].sort((a, b) => b - a);

  let streak = 1;
  let cursor = dates[0];

  for (let i = 1; i < dates.length; i++) {
    if (dates[i] === cursor - DAY_MS) {
      streak++;
      cursor = dates[i];
    } else {
      break;
    }
  }

  return streak;
}

export async function getLongestStreak(userId, metric) {
  const rows = await prisma.progressMetric.findMany({ where: { userId, metric } });
  if (!rows || !rows.length) return 0;
  return Math.max(...rows.map((r) => r.maxStreak ?? 0));
}

export async function getProgressEntryById(id, userId) {
  const entry = await prisma.progressEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Progress entry not found");
  if (entry.userId !== userId) throw new Error("Forbidden");
  return entry;
}

export async function updateProgressEntry(id, userId, data) {
  const entry = await prisma.progressEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Progress entry not found");
  if (entry.userId !== userId) throw new Error("Forbidden");

  const { value, note } = data;
  const updateData = { note };

  if (value !== undefined) {
    const goal = await prisma.goal.findUnique({ where: { id: entry.goalId } });
    const newValue = goal.currentValue - entry.value + value;
    const progressPercent = goal.targetValue > 0 ? (newValue / goal.targetValue) * 100 : 0;

    await prisma.goal.update({
      where: { id: goal.id },
      data: { currentValue: newValue },
    });

    updateData.value = value;
    updateData.progressPercent = progressPercent;
  }

  return prisma.progressEntry.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteProgressEntry(id, userId) {
  const entry = await prisma.progressEntry.findUnique({ where: { id } });
  if (!entry) throw new Error("Progress entry not found");
  if (entry.userId !== userId) throw new Error("Forbidden");

  const goal = await prisma.goal.findUnique({ where: { id: entry.goalId } });
  if (goal) {
    const newValue = Math.max(0, goal.currentValue - entry.value);
    await prisma.goal.update({
      where: { id: goal.id },
      data: { currentValue: newValue },
    });
  }

  return prisma.progressEntry.delete({ where: { id } });
}

export async function getProgressStats(userId) {
  const [entryCount, goalCount, activeGoalCount] = await Promise.all([
    prisma.progressEntry.count({ where: { userId } }),
    prisma.goal.count({ where: { userId } }),
    prisma.goal.count({ where: { userId, active: true } }),
  ]);

  const lastEntry = await prisma.progressEntry.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return {
    totalEntries: entryCount,
    totalGoals: goalCount,
    activeGoals: activeGoalCount,
    lastEntryAt: lastEntry?.createdAt ?? null,
  };
}

// --- Goal Management Functions ---

export async function createGoal(userId, data) {
  const { objectiveType, objectiveAction, targetValue, difficulty, unit } = data;

  return prisma.goal.create({
    data: {
      userId,
      targetValue,
      currentValue: 0,
      unit,
      difficulty,
      type: objectiveType,
      action: objectiveAction,
      active: true,
    },
  });
}

export async function getGoals(userId) {
  return prisma.goal.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGoalById(id, userId) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) throw new Error("Goal not found");
  if (goal.userId !== userId) throw new Error("Forbidden");
  return goal;
}

export async function updateGoal(id, userId, data) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) throw new Error("Goal not found");
  if (goal.userId !== userId) throw new Error("Forbidden");

  const updateData = { ...data };
  if (data.objectiveType) {
    updateData.type = data.objectiveType;
    delete updateData.objectiveType;
  }
  if (data.objectiveAction) {
    updateData.action = data.objectiveAction;
    delete updateData.objectiveAction;
  }

  return prisma.goal.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteGoal(id, userId) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) throw new Error("Goal not found");
  if (goal.userId !== userId) throw new Error("Forbidden");

  return prisma.goal.delete({ where: { id } });
}