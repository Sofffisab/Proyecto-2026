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