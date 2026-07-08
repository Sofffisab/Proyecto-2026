import { z } from "zod";

// ── Pantalla U: perfil mínimo — opciones fijas ────────────────────────────────
export const MAIN_GOAL_OPTIONS = ["LOSE_WEIGHT", "GAIN_MUSCLE", "IMPROVE_HEALTH", "INCREASE_ENDURANCE"];
export const EXPERIENCE_LEVEL_OPTIONS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
export const TRAINING_FREQUENCY_OPTIONS = ["ONE_TO_TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"];
export const TRAINING_TYPE_OPTIONS = ["STRENGTH", "CARDIO", "FUNCTIONAL", "MIXED"];

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  birthday: z.string().datetime().optional(),
  gender: z.string().max(50).optional(),
  // Nivel actual — 3 opciones fijas.
  trainingLevel: z.enum(EXPERIENCE_LEVEL_OPTIONS).optional(),
  medicalConditions: z.array(z.string()).optional(),
  // Objetivo principal — 4 opciones fijas, multi-select.
  objectives: z.array(z.enum(MAIN_GOAL_OPTIONS)).optional(),
  // Días que entrena por semana — 6 opciones fijas.
  weeklyTrainingDays: z.enum(TRAINING_FREQUENCY_OPTIONS).optional(),
  // Tipo de entrenamiento buscado — 4 opciones fijas.
  trainingType: z.enum(TRAINING_TYPE_OPTIONS).optional(),
  deliveryAddress: z.string().max(500).optional(),
});

export const updateProfileSchema = updateUserSchema;

export const updateSettingsSchema = z.object({
  disableAssistance: z.boolean().optional(),
  disableSocial: z.boolean().optional(),
  trainerPreference: z.string().nullable().optional(),
  // "No usar la app para máquinas": only entry/exit is scanned, no machine
  // QR is recorded, and the user is dropped from machine-based social
  // matching. They stay in the trainer's help list, just without any
  // machine/zone info attached.
  machineTrackingOptOut: z.boolean().optional(),
  // Consent to be included (even pseudonymized) in the admin full
  // analytics/history export. Defaults to true; users can withdraw it.
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

export const fcmTokenSchema = z.object({
  fcmToken: z.string().trim().min(1).max(500),
});