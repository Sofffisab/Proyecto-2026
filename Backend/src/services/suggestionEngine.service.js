import prisma from '../config/prisma.js';
import { createNotification } from './notification.service.js';

/**
 * Evaluates a user's progress against their active goals.
 * If more than 7 days have passed without an update, or progress is below 20%,
 * generates a suggestion notification.
 * @param {string} userId
 */
export async function evaluateUserProgress(userId) {
  const goals = await prisma.goal.findMany({
    where: { userId, active: true },
    include: {
      progress: {
        orderBy: { createdAt: 'desc' },
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

    // No update in more than 7 days
    if (daysSinceUpdate === null || daysSinceUpdate > 7) {
      await createNotification(
        userId,
        "Don't forget to log your progress",
        `You haven't updated your ${goal.type} goal in ${daysSinceUpdate ?? 'several'} days. Stay consistent!`
      );
      continue;
    }

    // Progress below 20% of goal
    if (progressPercent < 20) {
      await createNotification(
        userId,
        'Your progress needs attention',
        `Your ${goal.type} goal is at ${progressPercent.toFixed(0)}%. Consider adjusting your routine or consulting a trainer.`
      );
    }
  }
}

/**
 * Runs the suggestion engine for all active users. Called by the daily job.
 */
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