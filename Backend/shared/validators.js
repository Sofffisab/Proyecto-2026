import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase and number"),
  fullName: z.string().min(2, "Full name is required"),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers and underscores"),
});

export const helpRequestSchema = z.object({
  description: z.string().min(1, "Description is required").max(500),
});

export const progressUpdateSchema = z.object({
  exerciseName: z.string().min(1, "Exercise name is required"),
  weight: z.number().positive("Weight must be positive"),
  reps: z.number().int().positive("Reps must be a positive integer"),
  notes: z.string().optional(),
});

export const personalizationSchema = z.object({
  fieldName: z.string().min(1, "Field name is required"),
  value: z.string(),
});

export const routineSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  exercises: z.array(z.any()).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  reminderTime: z.string().optional(),
  remindersEnabled: z.boolean().optional(),
});

// Helper para validar
export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      error: "Validation error",
      code: "VALIDATION_ERROR",
      details: error.errors,
    });
  }
};