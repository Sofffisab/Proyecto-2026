import { z } from "zod";

export const goalSchema = z.object({
  objectiveAction: z.enum([
    "GAIN",
    "LOSE",
    "MAINTAIN",
  ]),

  objectiveType: z.enum([
    "WEIGHT",
    "MUSCLE",
    "FAT",
    "PHYSICAL_HEALTH",
    "MENTAL_HEALTH",
    "STRENGTH",
    "ENDURANCE",
    "COMMITMENT",
    "MOBILITY",
    "OTHER",
  ]),

  title: z
    .string()
    .trim()
    .min(1)
    .max(200),

  description: z
    .string()
    .max(1000)
    .optional(),

  targetValue: z.number(),

  currentValue: z
    .number()
    .optional(),

  unit: z
    .string()
    .max(50)
    .optional(),

  difficulty: z.enum([
    "EASY",
    "MEDIUM",
    "HARD",
  ]),
});

export const progressEntrySchema =
  z.object({
    goalId: z.string().uuid(),

    value: z.number(),
  });