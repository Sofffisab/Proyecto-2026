import { z } from "zod";

export const updateUserSchema =
  z.object({
    firstName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    lastName: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .optional(),

    birthday: z
      .string()
      .datetime()
      .optional(),

    gender: z
      .string()
      .max(50)
      .optional(),

    trainingLevel: z
      .string()
      .max(50)
      .optional(),

    medicalConditions: z
      .array(z.string())
      .optional(),

    objectives: z
      .array(z.string())
      .optional(),

    deliveryAddress: z
      .string()
      .max(500)
      .optional(),
  });

export const updateSettingsSchema =
  z.object({
    disableAssistance:
      z.boolean().optional(),

    disableSocial:
      z.boolean().optional(),

    trainerPreference:
      z.string().nullable().optional(),
  });

export const updateRoleSchema =
  z.object({
    role: z.enum([
      "USER",
      "TRAINER",
      "ADMIN",
    ]),
  });

export const deactivateUserSchema =
  z.object({
    isActive: z.boolean(),
  });

export const trainerProfileSchema =
  z.object({
    specialty: z
      .string()
      .trim()
      .min(1)
      .max(150),
  });