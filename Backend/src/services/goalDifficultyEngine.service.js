import { getUserBehaviorProfile } from "./behaviorAnalysis.service.js";

// Maps each GoalType to a fn scoring (targetValue, action) into a difficulty multiplier
const STANDARD_DIFFICULTY_TIERS = {
  WEIGHT: (target) => tierByMagnitude(target, [2, 5, 10], [0.7, 1.0, 1.4, 1.8]),
  FAT: (target) => tierByMagnitude(target, [2, 5, 10], [0.7, 1.0, 1.4, 1.8]),
  // Gaining muscle is harder than losing weight, so it uses a steeper curve
  MUSCLE: (target, action) =>
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

// Clamp final difficulty so extreme inputs can't blow the points budget
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

/** Standardized difficulty from goal type/action/magnitude, same for every user. The legacy `difficulty` enum field is intentionally ignored. */
export function computeStandardDifficulty(goal) {
  const tierFn = STANDARD_DIFFICULTY_TIERS[goal.type] ?? (() => 1.0);
  return Number(tierFn(goal.targetValue, goal.action).toFixed(2));
}

/** Personal adjustment: irregular attendance raises the factor (more effort with less structure); high frequency lowers it slightly. */
export async function computePersonalFactor(userId) {
  const profile = await getUserBehaviorProfile(userId);

  const consistency = profile.consistencyScore;
  const sessionsPerWeek = profile.avgSessionsPerWeek;

  // Not enough history yet — neutral factor
  if (consistency === null || consistency === undefined) return 1.0;

  // Low consistency => higher factor (up to +0.3)
  const irregularityBonus = (1 - consistency) * 0.3;

  // High frequency => slightly lower factor (down to -0.15, capped)
  const frequencyDiscount = sessionsPerWeek
    ? Math.min(0.15, Math.max(0, (sessionsPerWeek - 3) * 0.03))
    : 0;

  const factor = 1 + irregularityBonus - frequencyDiscount;
  return Number(Math.max(0.8, Math.min(1.3, factor)).toFixed(2));
}

/** Combines standardized difficulty with the personal factor into the final score. */
export async function computeGoalDifficultyScore(userId, goal) {
  const standard = computeStandardDifficulty(goal);
  const personal = await computePersonalFactor(userId);

  const combined = standard * personal;
  return Number(Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, combined)).toFixed(2));
}
