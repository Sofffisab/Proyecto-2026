import { z } from "zod";

// NOTE: there is intentionally no public self-registration schema/route here.
// Accounts are created exclusively by an Admin via POST /auth/users below
// (createUserByAdminSchema), which emails the person a link to set their own
// password. See routes/index.js's comment on the "PUBLIC / AUTH ROUTES"
// section for the full rationale.

export const createUserByAdminSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(["USER", "TRAINER", "ADMIN"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
});

export const verifyResetCodeSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  code: z.string().trim().length(6),
});

export const resetPasswordSchema = z.object({
  // No length constraint here: this same endpoint/field is also used by
  // the admin "create user" flow's 64-char hex "set your password" link
  // (see auth.service.js#createUserByAdmin), not just the 6-digit
  // forgot-password code.
  token: z.string().trim().min(1),
  newPassword: z.string().min(8).max(100),
});