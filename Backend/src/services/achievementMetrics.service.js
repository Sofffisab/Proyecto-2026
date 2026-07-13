import prisma from "../config/prisma.js";

// Streaks use the server's local calendar day/week (11pm and 1am next day
// still count as different days), matching what a member would expect.

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ISO-ish week key (year + Monday-start week number). Only ever diffed
// against adjacent keys, never parsed back into a date.
function weekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Counts consecutive units (from keyFn) with an entry in sortedDatesDesc,
// stopping at the first gap. `now` itself needs no entry — a user active
// through yesterday but not yet today still has a live streak.
function countConsecutiveStreak(datesDesc, keyFn, stepBack, now = new Date()) {
  const keysPresent = new Set(datesDesc.map(keyFn));

  let streak = 0;
  let cursor = now;

  // No activity in the current unit yet? Start counting from the previous
  // one so an in-progress day doesn't reset a live streak to 0.
  if (!keysPresent.has(keyFn(cursor))) {
    cursor = stepBack(cursor);
  }

  while (keysPresent.has(keyFn(cursor))) {
    streak++;
    cursor = stepBack(cursor);
  }

  return streak;
}

function stepDay(d) {
  const next = new Date(d);
  next.setDate(next.getDate() - 1);
  return next;
}

function stepWeek(d) {
  const next = new Date(d);
  next.setDate(next.getDate() - 7);
  return next;
}

function stepMonth(d) {
  const next = new Date(d);
  next.setMonth(next.getMonth() - 1);
  return next;
}

async function getCheckInDates(userId) {
  const sessions = await prisma.gymSession.findMany({
    where: { userId },
    select: { checkInAt: true },
    orderBy: { checkInAt: "desc" },
  });
  return sessions.map((s) => new Date(s.checkInAt));
}

/** Current consecutive-day attendance streak (0 if the user hasn't been in today or yesterday). */
export async function getStreakDays(userId, now = new Date()) {
  const dates = await getCheckInDates(userId);
  return countConsecutiveStreak(dates, dateKey, stepDay, now);
}

/** Current consecutive-week attendance streak (at least one visit per week). */
export async function getStreakWeeks(userId, now = new Date()) {
  const dates = await getCheckInDates(userId);
  return countConsecutiveStreak(dates, weekKey, stepWeek, now);
}

/** Current consecutive-month attendance streak (at least one visit per month). */
export async function getStreakMonths(userId, now = new Date()) {
  const dates = await getCheckInDates(userId);
  return countConsecutiveStreak(dates, monthKey, stepMonth, now);
}

/** Total social interactions the user has logged (e.g. completed challenges with other members). */
export async function getSocialInteractionsCount(userId) {
  return prisma.socialInteraction.count({ where: { userId } });
}

/** Total completed (ended) machine usages the user has logged. */
export async function getMachineUsesCount(userId) {
  return prisma.machineUsage.count({ where: { userId, endedAt: { not: null } } });
}

/** Computes every metric an Achievement can be evaluated against in one pass. */
export async function computeUserMetrics(userId, now = new Date()) {
  const [streakDays, streakWeeks, streakMonths, socialInteractions, machineUses] = await Promise.all([
    getStreakDays(userId, now),
    getStreakWeeks(userId, now),
    getStreakMonths(userId, now),
    getSocialInteractionsCount(userId),
    getMachineUsesCount(userId),
  ]);

  return {
    STREAK_DAYS: streakDays,
    STREAK_WEEKS: streakWeeks,
    STREAK_MONTHS: streakMonths,
    SOCIAL_INTERACTIONS: socialInteractions,
    MACHINE_USES: machineUses,
  };
}
