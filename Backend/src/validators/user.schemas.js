import { z } from "zod";

// Minimal-profile screen: fixed option sets
export const MAIN_GOAL_OPTIONS = ["LOSE_WEIGHT", "GAIN_MUSCLE", "IMPROVE_HEALTH", "INCREASE_ENDURANCE"];
export const EXPERIENCE_LEVEL_OPTIONS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
export const TRAINING_FREQUENCY_OPTIONS = ["ONE_TO_TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"];
export const TRAINING_TYPE_OPTIONS = ["STRENGTH", "CARDIO", "FUNCTIONAL", "MIXED"];

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  birthday: z.string().datetime().optional(),
  gender: z.string().max(50).optional(),
  // Current level — 3 fixed options.
  trainingLevel: z.enum(EXPERIENCE_LEVEL_OPTIONS).optional(),
  medicalConditions: z.array(z.string()).optional(),
  // Main goal — 4 fixed options, multi-select.
  objectives: z.array(z.enum(MAIN_GOAL_OPTIONS)).optional(),
  // Weekly training days — 6 fixed options.
  weeklyTrainingDays: z.enum(TRAINING_FREQUENCY_OPTIONS).optional(),
  // Desired training type — 4 fixed options.
  trainingType: z.enum(TRAINING_TYPE_OPTIONS).optional(),
  deliveryAddress: z.string().max(500).optional(),
});

export const updateProfileSchema = updateUserSchema;

export const updateSettingsSchema = z.object({
  disableAssistance: z.boolean().optional(),
  disableSocial: z.boolean().optional(),
  trainerPreference: z.string().nullable().optional(),
  // Opt out of machine QR scans; only gym entry/exit is tracked.
  machineTrackingOptOut: z.boolean().optional(),
  // Consent to appear (pseudonymized) in admin analytics exports. Default true.
  analyticsConsent: z.boolean().optional(),
});

export const notificationPreferencesSchema = updateSettingsSchema;

export const updateRoleSchema = z.object({
  role: z.enum(["USER", "TRAINER", "ADMIN"]),
});

export const deactivateUserSchema = z.object({
  isActive: z.boolean(),
});

export const trainerProfileSchema = z.object({
  specialty: z.string().trim().min(1).max(150),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

export const gymCheckinSchema = z.object({}).optional();

export const createNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
});

export const requestRoutineSchema = z.object({
  trainerId: z.string().uuid().optional(),
});

// PATCH /assistance/:id/assign — trainer taking ownership of a pending
// "Pedir Ayuda" request. Controller reads req.validatedData.trainerId,
// which requires this schema to be wired into the route (see routes/index.js).
export const assignAssistanceSchema = z.object({
  trainerId: z.string().uuid(),
});

export const fcmTokenSchema = z.object({
  fcmToken: z.string().trim().min(1).max(500),
});