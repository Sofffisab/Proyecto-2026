import { z } from "zod";

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  birthday: z.string().datetime().optional(),
  gender: z.string().max(50).optional(),
  trainingLevel: z.string().max(50).optional(),
  medicalConditions: z.array(z.string()).optional(),
  objectives: z.array(z.string()).optional(),
  deliveryAddress: z.string().max(500).optional(),
});

export const updateProfileSchema = updateUserSchema;

export const updateSettingsSchema = z.object({
  disableAssistance: z.boolean().optional(),
  disableSocial: z.boolean().optional(),
  trainerPreference: z.string().nullable().optional(),
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
});

export const requestRoutineSchema = z.object({
  trainerId: z.string().uuid().optional(),
});