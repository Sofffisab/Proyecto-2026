import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .toLowerCase(),

  password: z
    .string()
    .min(8)
    .max(100),

  role: z.enum([
    "USER",
    "TRAINER",
    "ADMIN",
  ]),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .toLowerCase(),

  password: z.string().min(1),
});

export const refreshTokenSchema =
  z.object({
    refreshToken: z
      .string()
      .min(1),
  });