import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma, redis } from "../config/index.js";
import { sendPasswordResetEmail, sendEmail } from "./communication.service.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

function sanitizeUser(user) {
  const { passwordHash, passwordResetToken, passwordResetExpires, ...safe } = user;
  return safe;
}

// Admin creates an account on behalf of a member/trainer: no password is
// chosen by the admin. Generates an unusable placeholder hash and emails a
// "set your password" link (same mechanism as forgotPassword).
export async function createUserByAdmin(data) {
  const { email, firstName, lastName, role = "USER" } = data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new AppError("Email already in use", 400);

  const randomPassword = crypto.randomBytes(24).toString("hex");
  const passwordHash = await bcrypt.hash(randomPassword, 10);

  const setPasswordToken = crypto.randomBytes(32).toString("hex");
  const setPasswordTokenHash = crypto.createHash("sha256").update(setPasswordToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days to set it up

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      passwordResetToken: setPasswordTokenHash,
      passwordResetExpires: expiresAt,
    },
  });

  const setPasswordUrl = `${process.env.FRONTEND_URL}/reset-password?token=${setPasswordToken}`;
  await sendEmail(
    email,
    "Your Gym App account was created",
    `<h1>Welcome, ${firstName}!</h1>
     <p>An administrator created an account for you at Gym App.</p>
     <p><strong>Email:</strong> ${email}</p>
     <p>Set your password to get started (link valid for 7 days):</p>
     <a href="${setPasswordUrl}">${setPasswordUrl}</a>`
  );

  return sanitizeUser(user);
}

// Accepts the validated { email, password } object directly
export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Invalid credentials", 401);

  // Keep `userId` field name consistent with the signing side
  const accessToken = jwt.sign({ userId: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: "7d" });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function refreshToken(token) {
  try {
    // Reads `userId` from payload (consistent with sign)
    const payload = jwt.verify(token, REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || !user.isActive) throw new AppError("User unavailable", 401);

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    return { accessToken };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid or expired refresh token", 401);
  }
}

export async function logout(token) {
  if (redis && token) {
    const decoded = jwt.decode(token);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl =
      decoded && decoded.exp
        ? Math.max(Math.round(decoded.exp - nowSeconds), 1)
        : ACCESS_TOKEN_TTL_SECONDS;
    await redis.setex(`blacklist:${token}`, ttl, "1");
  }
  return { success: true };
}

export async function forgotPassword(data) {
  const email = typeof data === "string" ? data : data.email;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return { message: "If email exists, reset code was sent" };

  // 6-digit numeric code (not a long token): meant to be read from an
  // email and typed in by hand on the "check your email" step (see
  // Frontend/src/screens/auth/ForgotPasswordScreen.js). Short TTL since
  // it's a much smaller keyspace than the old 32-byte hex token.
  const resetCode = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const resetCodeHash = crypto.createHash("sha256").update(resetCode).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: resetCodeHash, passwordResetExpires: expiresAt },
  });

  await sendPasswordResetEmail(user.email, resetCode, user.id);

  return { message: "If email exists, reset code was sent" };
}

// Lets the "check your email" step (ForgotPasswordScreen) confirm the code
// is right *before* asking for a new password, without consuming it yet —
// the code is only cleared once resetPassword() below actually succeeds.
export async function verifyResetCode({ email, code }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");

  if (
    !user ||
    !user.passwordResetToken ||
    user.passwordResetToken !== codeHash ||
    (user.passwordResetExpires && user.passwordResetExpires < new Date())
  ) {
    throw new AppError("Invalid or expired code", 400);
  }

  return { valid: true };
}

export async function resetPassword(data) {
  const { token, newPassword } = data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // findFirst, not findUnique: passwordResetToken has no @unique constraint
  // in schema.prisma (a 6-digit code isn't a safe uniqueness key across all
  // users), so findUnique would throw on this field.
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: tokenHash },
  });

  if (!user || (user.passwordResetExpires && user.passwordResetExpires < new Date())) {
    throw new AppError("Invalid or expired reset code", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return { message: "Password reset successful" };
}