import { prisma } from "../config/index.js";
import { createNotification } from "./communication.service.js";
import { addPoints } from "./gamification.service.js";
import { POINTS, CONSISTENCY_BONUS_THRESHOLDS } from "../constants/points.js";
import { logger } from "../utils/logger.js";

// Two sessions count as "the same routine" when their machine sets overlap
// by at least this fraction (Jaccard similarity) — tolerates skipped/added machines.
const ROUTINE_SIMILARITY_THRESHOLD = 0.7;
// A routine signature needs to show up at least this many times before we
// call it a "pattern" rather than a one-off session.
const ROUTINE_MIN_OCCURRENCES = 3;

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/**
 * Learns a user's training patterns (frequent days/hours, top machines,
 * recurring routines, attendance consistency) from their session history.
 * Other engines (difficulty, points) read this via getUserBehaviorProfile.
 */
export async function analyzeUserPatterns(userId) {
  const sessions = await prisma.gymSession.findMany({
    where: { userId },
    include: { machineUsages: { include: { machine: true } } },
    orderBy: { checkInAt: "asc" },
  });

  const sessionCount = sessions.length;

  // Weekday + hour frequency
  const dayCount = {};
  const hourCount = {};
  for (const session of sessions) {
    const checkIn = new Date(session.checkInAt);
    const day = checkIn.getDay();
    dayCount[day] = (dayCount[day] || 0) + 1;
    const hour = checkIn.getHours();
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  }

  const frequentDays = Object.entries(dayCount)
    .map(([day, count]) => ({
      day: Number(day),
      name: DAY_NAMES[Number(day)],
      count,
      share: sessionCount > 0 ? Number((count / sessionCount).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const preferredHour = Object.entries(hourCount).length
    ? Number(Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0][0])
    : null;

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

  // Recurring routine detection: cluster sessions by machine overlap
  const sessionSignatures = sessions
    .map((session) => {
      const machines = [...new Set((session.machineUsages ?? []).map((u) => u.machine.name))].sort();
      return { checkInAt: session.checkInAt, machines };
    })
    .filter((s) => s.machines.length > 0);

  const routines = detectRoutines(sessionSignatures);

  // Consistency score: based on regularity of gaps between sessions
  const { consistencyScore, avgSessionsPerWeek } = computeConsistency(
    sessions.map((s) => new Date(s.checkInAt))
  );

  return {
    sessionCount,
    frequentDays,
    preferredHour,
    topMachines,
    routines,
    consistencyScore,
    avgSessionsPerWeek,
  };
}

/** Groups session machine-signatures into routines via greedy Jaccard-similarity clustering. */
function detectRoutines(sessionSignatures) {
  const clusters = []; // [{ machines: Set, occurrences: number, lastSeenAt: Date }]

  for (const { checkInAt, machines } of sessionSignatures) {
    const machineSet = new Set(machines);
    let bestCluster = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score = jaccardSimilarity(cluster.machines, machineSet);
      if (score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestScore >= ROUTINE_SIMILARITY_THRESHOLD) {
      bestCluster.occurrences += 1;
      if (checkInAt > bestCluster.lastSeenAt) bestCluster.lastSeenAt = checkInAt;
      // Keep only machines consistently present across occurrences
      bestCluster.machines = intersect(bestCluster.machines, machineSet);
    } else {
      clusters.push({ machines: machineSet, occurrences: 1, lastSeenAt: checkInAt });
    }
  }

  return clusters
    .filter((c) => c.occurrences >= ROUTINE_MIN_OCCURRENCES)
    .sort((a, b) => b.occurrences - a.occurrences)
    .map((c) => ({
      signature: [...c.machines].sort(),
      occurrences: c.occurrences,
      lastSeenAt: c.lastSeenAt,
    }));
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersectionSize = [...setA].filter((m) => setB.has(m)).length;
  const unionSize = new Set([...setA, ...setB]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function intersect(setA, setB) {
  return new Set([...setA].filter((m) => setB.has(m)));
}

/** Consistency score in [0,1]: 1 = perfectly regular cadence, 0/null = irregular or not enough data. */
function computeConsistency(checkInDates) {
  if (checkInDates.length < 3) {
    return { consistencyScore: null, avgSessionsPerWeek: null };
  }

  const sorted = [...checkInDates].sort((a, b) => a - b);
  const DAY_MS = 1000 * 60 * 60 * 24;
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i] - sorted[i - 1]) / DAY_MS);
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avgGap <= 0) {
    return { consistencyScore: 1, avgSessionsPerWeek: 7 };
  }

  const variance = gaps.reduce((acc, g) => acc + (g - avgGap) ** 2, 0) / gaps.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation, inverted so 1 = regular, 0 = irregular
  const coefficientOfVariation = stdDev / avgGap;
  const consistencyScore = Number(Math.max(0, 1 - Math.min(1, coefficientOfVariation)).toFixed(2));

  const totalSpanDays = (sorted[sorted.length - 1] - sorted[0]) / DAY_MS || 1;
  const avgSessionsPerWeek = Number((sorted.length / (totalSpanDays / 7)).toFixed(2));

  return { consistencyScore, avgSessionsPerWeek };
}

/** ISO-week id (e.g. "2026-W27"), used to dedupe the weekly bonus per user. */
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Rewards attendance that's both frequent and regular (thresholds in constants/points.js). Once per ISO week per user. */
export async function awardConsistencyBonus(userId, patterns) {
  const { consistencyScore, avgSessionsPerWeek } = patterns;
  const { MIN_CONSISTENCY_SCORE, MIN_SESSIONS_PER_WEEK } = CONSISTENCY_BONUS_THRESHOLDS;

  if (
    consistencyScore == null ||
    avgSessionsPerWeek == null ||
    consistencyScore < MIN_CONSISTENCY_SCORE ||
    avgSessionsPerWeek < MIN_SESSIONS_PER_WEEK
  ) {
    return null;
  }

  const weekKey = isoWeekKey(new Date());
  const reason = `Consistent attendance bonus (${weekKey})`;

  const alreadyAwarded = await prisma.pointTransaction.findFirst({
    where: { userId, reason },
  });
  if (alreadyAwarded) return null;

  return addPoints(userId, POINTS.CONSISTENCY_WEEKLY_BONUS, reason);
}

/**
 * Recomputes and persists the behavior profile for a single user.
 */
export async function refreshUserBehaviorProfile(userId) {
  const patterns = await analyzeUserPatterns(userId);

  return prisma.userBehaviorProfile.upsert({
    where: { userId },
    update: {
      sessionCount: patterns.sessionCount,
      frequentDays: patterns.frequentDays,
      preferredHour: patterns.preferredHour,
      topMachines: patterns.topMachines,
      routines: patterns.routines,
      consistencyScore: patterns.consistencyScore,
      avgSessionsPerWeek: patterns.avgSessionsPerWeek,
      calculatedAt: new Date(),
    },
    create: {
      userId,
      sessionCount: patterns.sessionCount,
      frequentDays: patterns.frequentDays,
      preferredHour: patterns.preferredHour,
      topMachines: patterns.topMachines,
      routines: patterns.routines,
      consistencyScore: patterns.consistencyScore,
      avgSessionsPerWeek: patterns.avgSessionsPerWeek,
    },
  });
}

/** Reads the cached profile, or computes it on demand if the nightly job hasn't run yet. */
export async function getUserBehaviorProfile(userId) {
  const cached = await prisma.userBehaviorProfile.findUnique({ where: { userId } });
  if (cached) return cached;

  const patterns = await analyzeUserPatterns(userId);
  return { userId, ...patterns, calculatedAt: null };
}

/**
 * Runs pattern analysis for all active users, persists each profile, and
 * sends an in-app notification summary.
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

      await refreshUserBehaviorProfile(user.id);

      awardConsistencyBonus(user.id, patterns).catch((err) =>
        logger.error(`[behavior-analysis] Failed to award consistency bonus for user ${user.id}:`, err.message)
      );

      const topDay = patterns.frequentDays[0];
      const topMachine = patterns.topMachines[0];
      const topRoutine = patterns.routines[0];

      const parts = [];
      if (topDay) parts.push(`Your favourite training day is ${topDay.name}`);
      if (topMachine) parts.push(`your most-used machine is ${topMachine.name}`);
      if (topRoutine) {
        parts.push(
          `you have a recurring routine of ${topRoutine.signature.join(", ")} (seen ${topRoutine.occurrences} times)`
        );
      }

      if (parts.length) {
        await createNotification(
          user.id,
          "Your training patterns",
          parts.join(" and ") + "."
        );
      }
    } catch (err) {
      logger.error(`[behavior-analysis] Failed for user ${user.id}:`, err.message);
    }
  }
}
