import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "./communication.service.js";
import { AppError } from "../utils/errors.js"; // Importado

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
  if (exists) throw new AppError("Email already in use", 409); // 409 Conflict

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, role: "USER" },
  });

  sendWelcomeEmail(user).catch((err) =>
    console.error(`[auth.service] Failed to send welcome email to ${email}:`, err.message)
  );

  const accessToken = jwt.sign({ id: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: "7d" });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials", 401); // 401 Unauthorized
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("Invalid credentials", 401); // 401 Unauthorized

  const accessToken = jwt.sign({ id: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: "7d" });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function refreshToken(token) {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    
    if (!user || !user.isActive) throw new AppError("User unavailable", 401);

    const accessToken = jwt.sign({ id: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    return { accessToken };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid or expired refresh token", 401);
  }
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

  if (!user) throw new AppError("Invalid or expired reset token", 400); // 400 Bad Request

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return { success: true };
}