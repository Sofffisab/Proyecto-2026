import { POINTS } from "../constants/points.js";
import { computeGoalDifficultyScore } from "./goalDifficultyEngine.service.js";

/**
 * Computes how many points a single progress update is worth.
 *
 * Combines three inputs, as requested:
 *  1. % of the goal covered by THIS update (not just a flat per-log amount) —
 *     progress that closes 20% of the goal earns more than progress that
 *     closes 1% of it.
 *  2. Standardized difficulty per goal type/action/target magnitude.
 *  3. The user's personal case (consistency/attendance pattern), via the
 *     behavior-analysis engine.
 *
 * @param {string} userId
 * @param {object} goal - goal record (must include type, action, targetValue, difficulty)
 * @param {{ previousPercent: number, newPercent: number }} progress
 * @returns {Promise<{ points: number, breakdown: object }>}
 */
export async function computeProgressPoints(userId, goal, { previousPercent, newPercent }) {
  const difficultyScore = await computeGoalDifficultyScore(userId, goal);

  const clampedPrevious = Math.max(0, Math.min(100, previousPercent || 0));
  const clampedNew = Math.max(0, Math.min(100, newPercent || 0));
  const deltaPercent = Math.max(0, clampedNew - clampedPrevious);

  // Flat participation bonus for logging at all, so users are never
  // discouraged from tracking tiny/maintenance updates.
  const participationPoints = POINTS.PROGRESS_UPDATE;

  // Proportional share of the goal's total point budget, scaled by
  // difficulty, for the percentage this specific update contributed.
  const proportionalPoints = POINTS.GOAL_COMPLETION_BASE * difficultyScore * (deltaPercent / 100);

  // One-time bonus the moment the goal is completed for the first time.
  const justCompleted = clampedPrevious < 100 && clampedNew >= 100;
  const completionBonus = justCompleted ? POINTS.GOAL_FULLY_COMPLETED_BONUS * difficultyScore : 0;

  const totalPoints = Math.max(
    1,
    Math.round(participationPoints + proportionalPoints + completionBonus)
  );

  return {
    points: totalPoints,
    breakdown: {
      difficultyScore,
      deltaPercent: Number(deltaPercent.toFixed(2)),
      participationPoints,
      proportionalPoints: Math.round(proportionalPoints),
      completionBonus: Math.round(completionBonus),
    },
  };
}
