import { DIFFICULTY_MULTIPLIERS } from "../constants/points.js";
import { getUserBehaviorProfile } from "./behaviorAnalysis.service.js";

/**
 * Tier thresholds encoding "generalized difficulty standards" per goal
 * type/action (e.g. losing 10kg of fat is objectively harder than losing
 * 2kg). These are the current agreed-upon defaults; if fitness/nutrition
 * guidance changes, update the thresholds below.
 *
 * Each entry maps a GoalType to a function that scores a given
 * (targetValue, action) into a difficulty multiplier. Types without a
 * meaningful physical scale (COMMITMENT, MENTAL_HEALTH, NONE, OTHER) fall
 * back to the user/trainer-chosen GoalDifficulty enum only.
 */
const STANDARD_DIFFICULTY_TIERS = {
  WEIGHT: (target) => tierByMagnitude(target, [2, 5, 10], [0.7, 1.0, 1.4, 1.8]),
  FAT: (target) => tierByMagnitude(target, [2, 5, 10], [0.7, 1.0, 1.4, 1.8]),
  MUSCLE: (target, action) =>
    // Gaining muscle mass is generally slower/harder than losing weight for
    // the same magnitude, so it gets a steeper curve.
    tierByMagnitude(target, [1, 3, 6], action === "GAIN" ? [0.9, 1.3, 1.7, 2.2] : [0.7, 1.0, 1.4, 1.8]),
  STRENGTH: (target) => tierByMagnitude(target, [10, 25, 50], [0.7, 1.0, 1.4, 1.8]),
  ENDURANCE: (target) => tierByMagnitude(target, [5, 15, 30], [0.7, 1.0, 1.4, 1.8]),
  MOBILITY: (target) => tierByMagnitude(target, [10, 25, 50], [0.6, 0.9, 1.2, 1.5]),
  PHYSICAL_HEALTH: () => 1.1,
  MENTAL_HEALTH: () => 1.1,
  COMMITMENT: () => 1.0,
  NONE: () => 1.0,
  OTHER: () => 1.0,
};

// Clamp the final combined difficulty into a sane range so a single extreme
// input (e.g. a huge personal-factor swing) can't blow the points budget.
const MIN_DIFFICULTY = 0.4;
const MAX_DIFFICULTY = 2.5;

/**
 * Scores a target value into one of four difficulty buckets based on
 * magnitude thresholds, independent of any single user's history.
 */
function tierByMagnitude(target, thresholds, scores) {
  const value = Math.abs(Number(target) || 0);
  for (let i = 0; i < thresholds.length; i++) {
    if (value <= thresholds[i]) return scores[i];
  }
  return scores[scores.length - 1];
}

/**
 * Standardized difficulty: a generalized score based on goal type, action,
 * and target magnitude — the same for every user attempting a similar goal.
 * Blended 50/50 with the trainer/user-chosen GoalDifficulty enum, since that
 * still carries real signal (e.g. medical constraints the formula can't see).
 */
export function computeStandardDifficulty(goal) {
  const tierFn = STANDARD_DIFFICULTY_TIERS[goal.type] ?? (() => 1.0);
  const magnitudeScore = tierFn(goal.targetValue, goal.action);
  const enumScore = DIFFICULTY_MULTIPLIERS[goal.difficulty] ?? 1.0;

  return Number(((magnitudeScore + enumScore) / 2).toFixed(2));
}

/**
 * Personal-case adjustment: two users hitting the same objective standardized
 * difficulty aren't necessarily putting in the same effort. Someone with an
 * irregular attendance pattern (low consistencyScore) who is still making
 * progress is doing more with less structure, so their factor goes up. Someone
 * who trains very frequently gets more chances to progress, so their factor
 * is pulled slightly down to avoid over-rewarding sheer frequency over effort.
 */
export async function computePersonalFactor(userId) {
  const profile = await getUserBehaviorProfile(userId);

  const consistency = profile.consistencyScore;
  const sessionsPerWeek = profile.avgSessionsPerWeek;

  // Not enough history yet — neutral factor.
  if (consistency === null || consistency === undefined) return 1.0;

  // Low consistency (irregular attendance) => higher factor, up to +0.3.
  const irregularityBonus = (1 - consistency) * 0.3;

  // High attendance frequency => slightly lower factor, down to -0.15,
  // floored at 0 sessions/week and capped so it never dominates.
  const frequencyDiscount = sessionsPerWeek
    ? Math.min(0.15, Math.max(0, (sessionsPerWeek - 3) * 0.03))
    : 0;

  const factor = 1 + irregularityBonus - frequencyDiscount;
  return Number(Math.max(0.8, Math.min(1.3, factor)).toFixed(2));
}

/**
 * Combines the standardized (objective) difficulty with the user's personal
 * case into the final difficulty score used by the scoring engine.
 */
export async function computeGoalDifficultyScore(userId, goal) {
  const standard = computeStandardDifficulty(goal);
  const personal = await computePersonalFactor(userId);

  const combined = standard * personal;
  return Number(Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, combined)).toFixed(2));
}
