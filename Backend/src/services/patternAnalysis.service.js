import prisma from "../config/prisma.js";
import { createNotification } from "./communication.service.js";
import { logger } from "../utils/logger.js";

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

const TOP_MACHINES_LIMIT = 5;

/**
 * Analyzes a single user's gym sessions to find their most frequent
 * training days and most used machines.
 */
export async function analyzeUserPatterns(userId) {
  const sessions = await prisma.gymSession.findMany({
    where: { userId },
    include: { machineUsages: { include: { machine: true } } },
  });

  const sessionCount = sessions.length;

  const dayCount = {};
  const machineCount = {};

  for (const session of sessions) {
    const checkIn = new Date(session.checkInAt);
    const day = checkIn.getDay();
    dayCount[day] = (dayCount[day] || 0) + 1;

    for (const usage of session.machineUsages ?? []) {
      const name = usage.machine.name;
      machineCount[name] = (machineCount[name] || 0) + 1;
    }
  }

  const frequentDays = Object.entries(dayCount)
    .map(([day, count]) => ({
      day: Number(day),
      name: DAY_NAMES[Number(day)],
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topMachines = Object.entries(machineCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_MACHINES_LIMIT);

  return {
    sessionCount,
    frequentDays,
    topMachines,
  };
}

/**
 * Runs pattern analysis for every user and notifies each one with a
 * summary of their favourite training day and machine. Users without
 * sessions are skipped, and a failure for one user doesn't stop the batch.
 */
export async function runPatternAnalysisForAll() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    try {
      const { sessionCount, frequentDays, topMachines } = await analyzeUserPatterns(user.id);

      if (sessionCount === 0) continue;

      let message = `Your favourite training day is ${frequentDays[0].name}.`;
      if (topMachines.length > 0) {
        message += ` Your most used machine is ${topMachines[0].name}.`;
      }

      await createNotification(user.id, "Your training patterns", message);
    } catch (error) {
      logger.error(`[patternAnalysis] Failed to analyze patterns for user ${user.id}: ${error.message}`);
    }
  }
}

export default {
  analyzeUserPatterns,
  runPatternAnalysisForAll,
};
