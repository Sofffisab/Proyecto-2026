import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./communication.service.js";
import { AppError } from "../utils/errors.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

function sanitizeUser(user) {
  const { passwordHash, passwordResetToken, passwordResetExpires, ...safe } = user;
  return safe;
}

export async function register(data) {
  const { email, password, firstName, lastName } = data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new AppError("Email already in use", 400);

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, role: "USER" },
  });

  Promise.resolve(sendWelcomeEmail(user.email, user.firstName, user.id)).catch((err) =>
    console.error(`[auth.service] Failed to send welcome email to ${email}:`, err.message)
  );

  // Fix #2: use `userId` consistently in JWT payload so middleware can read it
  const accessToken = jwt.sign({ userId: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: "7d" });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

// Fix #1: destructure { email, password } so callers can pass the validated object directly
export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Invalid credentials", 401);

  // Fix #2: use `userId` consistently in JWT payload
  const accessToken = jwt.sign({ userId: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: "7d" });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);
  return sanitizeUser(user);
}

export async function refreshToken(token) {
  try {
    // Fix #2: read `userId` from payload (consistent with sign)
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

  if (!user) return { message: "If email exists, reset link was sent" };

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: resetTokenHash, passwordResetExpires: expiresAt },
  });

  await sendPasswordResetEmail(user.email, resetToken, user.id);

  return { message: "If email exists, reset link was sent" };
}

export async function resetPassword(data) {
  const { token, password, newPassword } = data;
  const newPass = newPassword ?? password;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findUnique({
    where: { passwordResetToken: tokenHash },
  });

  if (!user || (user.passwordResetExpires && user.passwordResetExpires < new Date())) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  const passwordHash = await bcrypt.hash(newPass, 10);

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
