// src/constants/points.js
/**
 * IMPORTANT
 * ----------------------------------
 * ALL VALUES ARE PLACEHOLDERS.
 * THEY MUST BE REVIEWED AND UPDATED
 * ACCORDING TO BUSINESS DECISIONS.
 * ----------------------------------
 */

export const POINTS = {
  CHECK_IN: 10,

  CHECK_OUT: 5,

  MACHINE_USAGE: 5,

  PROGRESS_UPDATE: 20,

  // Total points "budget" for taking a goal from 0% to 100% progress, before
  // the standardized-difficulty and personal-case multipliers are applied.
  // Each progress update earns a slice of this budget proportional to how
  // much percentage it actually contributed (see scoringEngine.service.js).
  GOAL_COMPLETION_BASE: 200,

  // One-time bonus awarded the moment a goal crosses 100% for the first time,
  // on top of whatever slice of GOAL_COMPLETION_BASE the update itself earned.
  GOAL_FULLY_COMPLETED_BONUS: 50,

  SOCIAL_CHALLENGE_COMPLETED: 30,

  SOCIAL_CHALLENGE_ATTEMPTED: 10,

  SCANNED_BY_USER: 10,

  SCANNED_BY_TRAINER: 15,

  ACHIEVEMENT_UNLOCKED: 50,

  ROUTINE_DAY_COMPLETED: 10,

  APPROVED_COMPLAINT_PENALTY: -50,

  SUSPICIOUS_ACTIVITY_PENALTY: -100,
};

// Multiplier applied to POINTS.PROGRESS_UPDATE based on the difficulty of
// the goal being updated (see GoalDifficulty enum in schema.prisma).
export const DIFFICULTY_MULTIPLIERS = {
  EASY: 0.5,
  MEDIUM: 1.0,
  HARD: 1.5,
};

export default {
  POINTS,
  DIFFICULTY_MULTIPLIERS,
};