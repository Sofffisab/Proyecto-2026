import prisma from "../config/prisma.js";
import { createNotification } from "./communication.service.js";

export async function evaluateUserProgress(userId) {
  const goals = await prisma.goal.findMany({
    where: { userId, active: true },
    include: {
      progress: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  for (const goal of goals) {
    const lastEntry = goal.progress[0];
    const now = new Date();

    const daysSinceUpdate = lastEntry
      ? Math.floor((now - new Date(lastEntry.createdAt)) / (1000 * 60 * 60 * 24))
      : null;

    const progressPercent = lastEntry ? lastEntry.progressPercent : 0;

    if (daysSinceUpdate === null || daysSinceUpdate > 7) {
      await createNotification(
        userId,
        "Don't forget to log your progress",
        `You haven't updated your "${goal.type}" goal in ${daysSinceUpdate ?? "several"} days. Stay consistent!`
      );
      continue;
    }

    if (progressPercent < 20) {
      await createNotification(
        userId,
        "Your progress needs attention",
        `Your "${goal.type}" goal is at ${progressPercent.toFixed(0)}%. Consider adjusting your routine or consulting a trainer.`
      );
    }
  }
}

export async function runSuggestionEngineForAll() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    try {
      await evaluateUserProgress(user.id);
    } catch (err) {
      console.error(`[suggestionEngine] Failed for user ${user.id}:`, err.message);
    }
  }
}