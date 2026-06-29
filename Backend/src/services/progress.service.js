import prisma from "../config/prisma.js";
import { addPoints } from "./gamification.service.js";
import { POINTS, DIFFICULTY_MULTIPLIERS } from "../constants/points.js";

export async function addProgress(userId, goalId, value) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) throw new Error("Goal not found");

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

  const multiplier = DIFFICULTY_MULTIPLIERS[goal.difficulty] ?? 1.0;
  const pointsToAward = Math.round(POINTS.PROGRESS_UPDATE * multiplier);

  addPoints(userId, pointsToAward, `Progress update (${goal.difficulty} difficulty)`).catch(
    (err) => console.error("[progress] Failed to award points:", err.message)
  );

  return entry;
}

// --- Goal Management Functions ---

export async function createGoal(userId, data) {
  const { objectiveType, objectiveAction, name, targetValue, difficulty } = data;
  
  return prisma.goal.create({
    data: {
      userId,
      name,
      targetValue,
      currentValue: 0,
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