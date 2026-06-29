import { z } from "zod";

// ── Goal / Progress ──────────────────────────────────────────────────────────

export const goalSchema = z.object({
  objectiveAction: z.enum(["GAIN", "LOSE", "MAINTAIN"]),
  objectiveType: z.enum([
    "WEIGHT", "MUSCLE", "FAT", "PHYSICAL_HEALTH", "MENTAL_HEALTH",
    "STRENGTH", "ENDURANCE", "COMMITMENT", "MOBILITY", "NONE",
    "OTHER", 
  ]),
  targetValue: z.number(),
  currentValue: z.number().optional(),
  unit: z.string().max(50).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
});

export const createProgressSchema = z.object({
  goalId: z.string().uuid(),
  value: z.number(),
});

export const updateProgressSchema = z.object({
  value: z.number().optional(),
  note: z.string().max(500).optional(),
});

// ── Routines ─────────────────────────────────────────────────────────────────

export const createRoutineSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  isCustom: z.boolean().optional(),
  content: z.record(z.unknown()),
});

export const updateRoutineSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  content: z.record(z.unknown()).optional(),
});

// ── Rewards ──────────────────────────────────────────────────────────────────

export const createRewardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  pointsCost: z.number().int().min(0),
  active: z.boolean().optional(),
});

export const updateRewardSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  pointsCost: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export const approveRedemptionSchema = z.object({}).optional();

export const rejectRedemptionSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ── Challenges ───────────────────────────────────────────────────────────────

export const createChallengeSchema = z.object({
  userIdA: z.string().uuid(),
  userIdB: z.string().uuid(),
  station: z.string().max(200).optional(),
}).refine((data) => data.userIdA !== data.userIdB, {
  message: "A user cannot challenge themselves",
  path: ["userIdB"],
});

export const completeChallengeSchema = z.object({
  partnerId: z.string().uuid(),
});

export const cancelChallengeSchema = z.object({}).optional();

// ── Assistance ───────────────────────────────────────────────────────────────

export const requestAssistanceSchema = z.object({}).optional();

export const assignAssistanceSchema = z.object({
  trainerId: z.string().uuid(),
});

export const completeAssistanceSchema = z.object({}).optional();

// ── Complaints ───────────────────────────────────────────────────────────────

export const createComplaintSchema = z.object({
  reportedUserId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  message: z.string().max(2000).optional(),
});

export const resolveComplaintSchema = z.object({}).optional();

export const rejectComplaintSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ── QR ───────────────────────────────────────────────────────────────────────

export const generateQRSchema = z.object({}).optional();

export const validateQRSchema = z.object({
  payload: z.string().min(1),
});

const syncCheckinActionSchema = z.object({
  type: z.literal("checkin"),
  timestamp: z.string().datetime({ message: "timestamp must be a valid ISO 8601 date-time" }),
  payload: z.object({}).optional(),
});

const syncCheckoutActionSchema = z.object({
  type: z.literal("checkout"),
  timestamp: z.string().datetime(),
  payload: z.object({}).optional(),
});

const syncMachineStartActionSchema = z.object({
  type: z.literal("machineStart"),
  timestamp: z.string().datetime(),
  payload: z.object({
    machineId:    z.string().uuid(),
    gymSessionId: z.string().uuid().optional(),
  }),
});

const syncMachineEndActionSchema = z.object({
  type: z.literal("machineEnd"),
  timestamp: z.string().datetime(),
  payload: z.object({
    machineId: z.string().uuid(),
  }),
});

const syncActionSchema = z.discriminatedUnion("type", [
  syncCheckinActionSchema,
  syncCheckoutActionSchema,
  syncMachineStartActionSchema,
  syncMachineEndActionSchema,
]);

export const syncActionsSchema = z.object({
  actions: z
    .array(syncActionSchema)
    .min(1, "actions must be a non-empty array")
    .max(100, "cannot submit more than 100 actions per batch"),
});


export const pointReviewRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});


export const rateTrainerSchema = z.object({
  trainerId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
});


export const createMachineSchema = z.object({
  name: z.string().trim().min(1).max(200),
});