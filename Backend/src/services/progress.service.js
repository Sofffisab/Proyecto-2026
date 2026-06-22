import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { POINTS, DIFFICULTY_MULTIPLIERS } from "../constants/points.js";

export async function addProgress(userId, goalId, value) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) throw new Error("Goal not found");

  // Security: ensure the goal belongs to the requesting user
  if (goal.userId !== userId) {
    throw new Error("Forbidden: goal does not belong to this user");
  }

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

  // Award points scaled by goal difficulty
  const multiplier = DIFFICULTY_MULTIPLIERS[goal.difficulty] ?? 1.0;
  const pointsToAward = Math.round(POINTS.PROGRESS_UPDATE * multiplier);

  addPoints(userId, pointsToAward, `Progress update (${goal.difficulty} difficulty)`).catch(
    (err) => console.error("[progress] Failed to award points:", err.message)
  );

  return entry;
}

export async function getProgressHistory(userId) {
  return prisma.progressEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProgressEntryById(id, userId) {
  return prisma.progressEntry.findFirst({
    where: { id, userId },
  });
}

export async function updateProgressEntry(id, userId, data) {
  const entry = await prisma.progressEntry.findFirst({ where: { id, userId } });
  if (!entry) throw new Error("Progress entry not found");

  // Only allow whitelisted fields
  const safeData = {};
  if (data.value !== undefined) safeData.value = data.value;
  if (data.note !== undefined) safeData.note = data.note;

  return prisma.progressEntry.update({
    where: { id },
    data: safeData,
  });
}

export async function deleteProgressEntry(id, userId) {
  const entry = await prisma.progressEntry.findFirst({
    where: { id, userId },
    include: { goal: true },
  });
  if (!entry) throw new Error("Progress entry not found");

  // Recalculate goal.currentValue by subtracting this entry's value
  // so the goal stays consistent after deletion.
  const newCurrentValue = Math.max(0, (entry.goal?.currentValue ?? 0) - entry.value);
  await prisma.goal.update({
    where: { id: entry.goalId },
    data: { currentValue: newCurrentValue },
  });

  return prisma.progressEntry.delete({ where: { id } });
}

export async function getProgressStats(userId) {
  const entries = await prisma.progressEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (entries.length === 0) {
    return {
      totalProgress: 0,
      entriesCount: 0,
      avgDaysBetweenUpdates: null,
      stdDevDays: null,
      currentStreak: 0,
      longestStreak: 0,
    };
  }

  const total = entries.reduce((acc, e) => acc + e.value, 0);

  const intervals = [];
  for (let i = 1; i < entries.length; i++) {
    const prev = new Date(entries[i - 1].createdAt);
    const curr = new Date(entries[i].createdAt);
    intervals.push((curr - prev) / (1000 * 60 * 60 * 24));
  }

  let avgDaysBetweenUpdates = null;
  let stdDevDays = null;

  if (intervals.length > 0) {
    avgDaysBetweenUpdates = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((acc, d) => acc + Math.pow(d - avgDaysBetweenUpdates, 2), 0) /
      intervals.length;
    stdDevDays = Math.sqrt(variance);
  }

  const uniqueDays = [
    ...new Set(entries.map((e) => new Date(e.createdAt).toISOString().slice(0, 10))),
  ].sort();

  let streak = 1;
  let longestStreak = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
    } else {
      longestStreak = Math.max(longestStreak, streak);
      streak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, streak);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const lastDay = uniqueDays[uniqueDays.length - 1];
  const currentStreak = lastDay === today || lastDay === yesterdayStr ? streak : 0;

  return {
    totalProgress: total,
    entriesCount: entries.length,
    avgDaysBetweenUpdates: avgDaysBetweenUpdates !== null
      ? parseFloat(avgDaysBetweenUpdates.toFixed(2))
      : null,
    stdDevDays: stdDevDays !== null ? parseFloat(stdDevDays.toFixed(2)) : null,
    currentStreak,
    longestStreak,
  };
}