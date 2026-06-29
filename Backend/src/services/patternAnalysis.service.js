import prisma from "../config/prisma.js";
import { createNotification } from "./communication.service.js";

/**
 * Analyzes a user's training patterns:
 * most frequent days, most-used machines, and session sequences.
 * @param {string} userId
 * @returns {{ frequentDays: object[], topMachines: object[], sessionCount: number }}
 */
export async function analyzeUserPatterns(userId) {
  const sessions = await prisma.gymSession.findMany({
    where: { userId },
    include: { machineUsages: { include: { machine: true } } },
    orderBy: { checkInAt: "asc" },
  });

  // Weekday frequency count (0 = Sunday, 6 = Saturday)
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayCount = {};
  for (const session of sessions) {
    const day = new Date(session.checkInAt).getDay();
    dayCount[day] = (dayCount[day] || 0) + 1;
  }

  const frequentDays = Object.entries(dayCount)
    .map(([day, count]) => ({ day: Number(day), name: dayNames[Number(day)], count }))
    .sort((a, b) => b.count - a.count);

  // Most used machines
  const machineCount = {};
  for (const session of sessions) {
    for (const usage of session.machineUsages ?? []) {
      const name = usage.machine.name;
      machineCount[name] = (machineCount[name] || 0) + 1;
    }
  }

  const topMachines = Object.entries(machineCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    sessionCount: sessions.length,
    frequentDays,
    topMachines,
  };
}

/**
 * Runs pattern analysis for all active users
 * and sends an in-app notification summary to each user.
 */
export async function runPatternAnalysisForAll() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const user of users) {
    try {
      const patterns = await analyzeUserPatterns(user.id);

      if (patterns.sessionCount === 0) continue;

      const topDay = patterns.frequentDays[0];
      const topMachine = patterns.topMachines[0];

      if (topDay || topMachine) {
        const parts = [];
        if (topDay) parts.push(`Your favourite training day is ${topDay.name}`);
        if (topMachine) parts.push(`your most-used machine is ${topMachine.name}`);

        await createNotification(
          user.id,
          "Your training patterns",
          parts.join(" and ") + "."
        );
      }
    } catch (err) {
      console.error(`[pattern-analysis] Failed for user ${user.id}:`, err.message);
    }
  }
}