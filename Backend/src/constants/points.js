// src/constants/points.js
/**
 * Point values awarded/deducted for each gamification event.
 *
 * These are the current, agreed-upon defaults. If the business changes the
 * points economy, update the values below — every consumer of POINTS reads
 * from here, so there is a single source of truth to edit.
 *
 * DESIGN TARGET (why these specific numbers):
 * A realistically active member — ~3 gym visits/week, a handful of machines
 * per visit, occasionally logging progress or a social challenge — should
 * earn roughly 180-260 points/week. That means:
 *   - A "small" reward (~150-250 pts) is reachable in under a week — good
 *     for hooking new/casual users early without feeling out of reach.
 *   - A "medium" reward (~500-700 pts) takes about 2-3 weeks — the main
 *     cadence, frequent enough to stay motivating, slow enough to not feel
 *     spammy or trivially farmable.
 *   - A "large" reward (~1000-1500 pts) takes roughly a month of consistent
 *     attendance — an aspirational, low-frequency prize.
 *   - An "epic" reward (~3200-6500 pts) takes roughly 3-6 months — the
 *     slowest, most aspirational tier. This is the ceiling of the intended
 *     range: an admin should never configure a Reward.pointsCost above
 *     POINTS_HARD_CAP (see below), since a user could then accumulate
 *     points indefinitely without ever qualifying for a reset.
 * These pointsCost tiers are set per-Reward by an admin (Reward.pointsCost),
 * not hardcoded here — use this comment as the guideline when creating them:
 * spread active rewards across small/medium/large/epic so *some* reward is
 * always reachable in 1-6 months, and none requires longer than that.
 * Since points reset to 0 on every auto-granted reward (see
 * reward.service.js#autoGrantRewards), this weekly rate is also what keeps
 * the "climb back up" cycle from feeling either instant or endless.
 */

// Duration-weighted tiers for a single machine-usage cycle: the longer a
// user actually trains on a machine (real minutes, measured start-scan to
// end-scan/auto-close), the more the cycle is worth — "estar mucho tiempo
// en una máquina cuenta más que estar poco tiempo en la misma máquina".
// Read top-to-bottom, first tier whose minMinutes the duration meets or
// exceeds wins (see verification.service.js#computeMachineUsagePoints).
// Capped at MACHINE_USAGE_MAX so one very long usage still can't dominate
// the weekly points budget on its own.
export const MACHINE_USAGE_DURATION_TIERS = [
  { minMinutes: 45, points: 22 },
  { minMinutes: 25, points: 15 },
  { minMinutes: 10, points: 8 }, // matches POINTS.MACHINE_USAGE base
];
export const MACHINE_USAGE_MAX = 22;

// Absolute ceiling on a user's total point balance: the system must never
// let this reach 5 digits (10000+). autoGrantRewards resets points to 0
// every time a reward is granted, so under normal operation this is only a
// safety net for edge cases (e.g. no reward currently affordable/in stock)
// — see reward.service.js#enforcePointsCeiling.
export const POINTS_HARD_CAP = 9999;

// How long a MachineConflict ("2 personas en la misma máquina") stays open
// waiting for a trainer to verify in person before it's auto-marked
// UNVERIFIED and a complaint is raised against both users — see
// machineConflict.job.js#expireUnverifiedConflicts.
export const MACHINE_CONFLICT_VERIFICATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const POINTS = {
  CHECK_IN: 10,

  CHECK_OUT: 5,

  // Base award for a machine-usage cycle that clears the minimum duration
  // (on the "end" scan only — see MIN_MACHINE_USAGE_MINUTES_FOR_POINTS in
  // verification.service.js). This is the floor; the real award scales up
  // with time actually spent, see MACHINE_USAGE_DURATION_TIERS below and
  // verification.service.js#computeMachineUsagePoints. "Estar mucho tiempo
  // en una máquina cuenta más que estar poco tiempo": a quick tap in/out
  // that barely clears the minimum earns this base value, a long real set
  // earns progressively more, capped at MACHINE_USAGE_MAX so one usage can
  // never dominate the weekly points budget.
  MACHINE_USAGE: 8,

  // Small bonus paid to a TRAINER who verifies a MachineConflict ("2
  // personas en la misma máquina") in person. Deliberately small — "sube
  // calificación mínimamente" — recognition for helping keep order on the
  // floor, not a way to farm points.
  TRAINER_ORDER_BONUS: 5,

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
  MACHINE_USAGE_DURATION_TIERS,
  MACHINE_USAGE_MAX,
  POINTS_HARD_CAP,
  MACHINE_CONFLICT_VERIFICATION_WINDOW_MS,
};