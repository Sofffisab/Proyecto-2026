import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./communication.service.js";

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
  if (exists) throw new Error("Email already in use");

  const passwordHash = await bcrypt.hash(password, 10);

  // Role is always USER for public registration — ADMIN/TRAINER roles must be
  // assigned by an admin via PATCH /users/:id/role after account creation.
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, role: "USER" },
  });

  // Send welcome email (non-blocking — don't fail registration if email fails)
  sendWelcomeEmail(user).catch((err) =>
    console.error("[auth] Failed to send welcome email:", err.message)
  );

  return sanitizeUser(user);
}

export async function login(data) {
  const { email, password } = data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function me(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true, trainerProfile: true },
  });

  if (!user) return null;
  return sanitizeUser(user);
}

export async function refreshToken(data) {
  let payload;
  try {
    payload = jwt.verify(data.refreshToken, REFRESH_SECRET);
  } catch {
    throw new Error("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) throw new Error("User not found or disabled");

  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );

  return { accessToken };
}

export async function logout(token) {
  if (redis && token) {
    await redis.set(`blacklist:${token}`, 1, { ex: ACCESS_TOKEN_TTL_SECONDS });
  }
  return { success: true };
}

export async function forgotPassword(data) {
  const { email } = data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) return { success: true };

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: resetTokenHash, passwordResetExpires: expiresAt },
  });

  await sendPasswordResetEmail(user, resetToken);

  return { success: true };
}

export async function resetPassword(data) {
  const { token, password } = data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) throw new Error("Invalid or expired reset token");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
  });

  return { success: true };
}