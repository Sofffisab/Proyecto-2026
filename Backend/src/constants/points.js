// Point values for each gamification event. Single source of truth.
// Balanced so an active member (~3 visits/week) earns ~180-260 pts/week,
// keeping reward tiers reachable within 1 week to 6 months.

// Longer machine usage earns more points; first tier met/exceeded wins
// (verification.service.js#computeMachineUsagePoints), capped at MACHINE_USAGE_MAX.
export const MACHINE_USAGE_DURATION_TIERS = [
  { minMinutes: 45, points: 22 },
  { minMinutes: 25, points: 15 },
  { minMinutes: 10, points: 8 }, // matches POINTS.MACHINE_USAGE base
];
export const MACHINE_USAGE_MAX = 22;

// Safety-net ceiling on a user's point balance (reward.service.js#enforcePointsCeiling).
export const POINTS_HARD_CAP = 9999;

// Window for a trainer to verify a MachineConflict before it auto-expires.
export const MACHINE_CONFLICT_VERIFICATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const POINTS = {
  CHECK_IN: 10,

  CHECK_OUT: 5,

  // Base award for clearing the minimum usage duration; see MACHINE_USAGE_DURATION_TIERS.
  MACHINE_USAGE: 8,

  // Reward for a TRAINER resolving a MachineConflict in person.
  TRAINER_ORDER_BONUS: 5,

  PROGRESS_UPDATE: 20,

  // Budget for taking a goal 0%->100%; each update earns a proportional slice.
  GOAL_COMPLETION_BASE: 200,

  // One-time bonus on top of GOAL_COMPLETION_BASE when a goal first hits 100%.
  GOAL_FULLY_COMPLETED_BONUS: 50,

  SOCIAL_CHALLENGE_COMPLETED: 30,

  SOCIAL_CHALLENGE_ATTEMPTED: 10,

  ACHIEVEMENT_UNLOCKED: 50,

  ROUTINE_DAY_COMPLETED: 10,

  // Staff-facilitated help session completed with a trainer.
  ASSISTANCE_COMPLETED: 15,

  // Feedback signal on trainer quality; small to avoid farming.
  TRAINER_RATED: 10,

  // Weekly bonus for consistent attendance, max once/week (behaviorAnalysis.service.js).
  CONSISTENCY_WEEKLY_BONUS: 25,

  // Legacy value kept for reference; real penalty follows COMPLAINT_PENALTY below.
  APPROVED_COMPLAINT_PENALTY: -50,

  SUSPICIOUS_ACTIVITY_PENALTY: -100,
};

// Progressive penalty for APPROVED complaints: FREE_STRIKES cost nothing,
// then +STEP per complaint (capped at MAX_PENALTY) until ALERT_THRESHOLD
// triggers an admin review alert.
export const COMPLAINT_PENALTY = {
  FREE_STRIKES: 2,
  STEP: 25,
  MAX_PENALTY: 150,
  ALERT_THRESHOLD: 5,
};

// Multiplier on POINTS.PROGRESS_UPDATE by goal difficulty (see GoalDifficulty enum).
export const DIFFICULTY_MULTIPLIERS = {
  EASY: 0.5,
  MEDIUM: 1.0,
  HARD: 1.5,
};

// Minimum consistencyScore/avgSessionsPerWeek to earn CONSISTENCY_WEEKLY_BONUS.
export const CONSISTENCY_BONUS_THRESHOLDS = {
  MIN_CONSISTENCY_SCORE: 0.7,
  MIN_SESSIONS_PER_WEEK: 2,
};

export default {
  POINTS,
  DIFFICULTY_MULTIPLIERS,
  CONSISTENCY_BONUS_THRESHOLDS,
  COMPLAINT_PENALTY,
  MACHINE_USAGE_DURATION_TIERS,
  MACHINE_USAGE_MAX,
  POINTS_HARD_CAP,
  MACHINE_CONFLICT_VERIFICATION_WINDOW_MS,
};