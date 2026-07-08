// src/constants/points.js
/**
 * Point values awarded/deducted for each gamification event.
 *
 * These are the current, agreed-upon defaults. If the business changes the
 * points economy, update the values below — every consumer of POINTS reads
 * from here, so there is a single source of truth to edit.
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

  // Student engaged with a trainer and the help session actually happened —
  // a real-world, staff-facilitated interaction the gym wants to encourage.
  ASSISTANCE_COMPLETED: 15,

  // Rewards giving feedback on a trainer (helps the gym improve its
  // service) — small, so it can't be farmed, but non-zero because it's a
  // genuinely useful signal for the business.
  TRAINER_RATED: 10,

  // Weekly bonus for being frequent AND consistent — awarded at most once
  // per calendar week per user by behaviorAnalysis.service.js, based on the
  // learned UserBehaviorProfile (consistencyScore + avgSessionsPerWeek).
  // This is the "reward loyalty/attendance" lever the gym cares about most:
  // simply coming in often isn't enough on its own (a burst of visits in one
  // week shouldn't count), the cadence has to actually be regular.
  CONSISTENCY_WEEKLY_BONUS: 25,

  // Kept for backwards-compatibility / reference. Approved-complaint
  // penalties are no longer a flat value — see COMPLAINT_PENALTY below for
  // the progressive schedule applied in complaint.service.js#approveComplaint.
  APPROVED_COMPLAINT_PENALTY: -50,

  SUSPICIOUS_ACTIVITY_PENALTY: -100,
};

// Progressive penalty schedule for APPROVED complaints against a user.
// The first FREE_STRIKES approved complaints are "evaluated" but cost no
// points (a first offense shouldn't tank someone's score). Starting on the
// next one, a penalty kicks in and grows with every additional approved
// complaint, so repeat offenders lose more each time. Once a user racks up
// ALERT_THRESHOLD approved complaints total, an admin review alert is
// raised (PointReviewRequest) so a human looks at the pattern instead of
// the system silently continuing to dock points forever.
export const COMPLAINT_PENALTY = {
  // Approved complaints #1 and #2: no points deducted.
  FREE_STRIKES: 2,

  // Penalty grows by this amount for every approved complaint past the
  // free strikes: #3 = -25, #4 = -50, #5 = -75, #6 = -100, ...
  STEP: 25,

  // Penalty never exceeds this per single approval, no matter how far into
  // the progression the user is.
  MAX_PENALTY: 150,

  // Total approved complaints (against the same user) that trigger an
  // admin review alert, on top of the point deduction.
  ALERT_THRESHOLD: 5,
};

// Multiplier applied to POINTS.PROGRESS_UPDATE based on the difficulty of
// the goal being updated (see GoalDifficulty enum in schema.prisma).
export const DIFFICULTY_MULTIPLIERS = {
  EASY: 0.5,
  MEDIUM: 1.0,
  HARD: 1.5,
};

// Minimum learned consistencyScore (0..1) and avgSessionsPerWeek a user's
// UserBehaviorProfile must show to qualify for POINTS.CONSISTENCY_WEEKLY_BONUS.
// See behaviorAnalysis.service.js#awardConsistencyBonus.
export const CONSISTENCY_BONUS_THRESHOLDS = {
  MIN_CONSISTENCY_SCORE: 0.7,
  MIN_SESSIONS_PER_WEEK: 2,
};

export default {
  POINTS,
  DIFFICULTY_MULTIPLIERS,
  CONSISTENCY_BONUS_THRESHOLDS,
  COMPLAINT_PENALTY,
};