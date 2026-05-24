import { prisma } from "../prisma/prisma.js";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { sendPushAndNotification } from "./notifications.js";
import { NOTIFICATION_TYPES, ROLES, validateEmail, validatePassword } from "../shared/utils.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// ============ AUTH SERVICE ============

export const hashPassword = async (password) => {
  return await argon2.hash(password);
};

export const verifyPassword = async (password, hash) => {
  return await argon2.verify(hash, password);
};

export const signAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
};

export const signRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// ============ AUTH CONTROLLERS ============

export const register = async (req, res) => {
  try {
    const { email, password, fullName, username } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error: "Password must be at least 8 characters with uppercase, lowercase, and numbers",
      });
    }

    if (!fullName || !username) {
      return res.status(400).json({ error: "Full name and username are required" });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        id: uuid(),
        email,
        password: hashedPassword,
        fullName,
        username,
        role: ROLES.USER,
        profileComplete: false,
        tokenVersion: 0,
        photo: req.file ? await photoToBase64(req.file) : null,
      },
    });

    // Create user points record
    await prisma.userPoints.create({
      data: {
        userId: user.id,
        totalPoints: 0,
        currentPoints: 0,
      },
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.status(201).json({
      message: "User registered successfully",
      user: formatUserResponse(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("[AUTH] Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.accountPaused) {
      return res.status(403).json({ error: "Account is paused" });
    }

    const passwordValid = await verifyPassword(password, user.password);

    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.status(200).json({
      message: "Login successful",
      user: formatUserResponse(user),
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token is required" });
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.accountPaused) {
      return res.status(401).json({ error: "User not found or account paused" });
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: "Token has been revoked. Please login again." });
    }

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    res.status(200).json({
      message: "Token refreshed",
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("[AUTH] Refresh token error:", error);
    res.status(500).json({ error: "Token refresh failed" });
  }
};

export const validate = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.status(200).json({
      message: "Token is valid",
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("[AUTH] Validate error:", error);
    res.status(500).json({ error: "Validation failed" });
  }
};

export const logout = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { tokenVersion: { increment: 1 } },
    });

    res.status(200).json({
      message: "Logout successful. All sessions have been invalidated.",
    });
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

// ============ HELPERS ============

const photoToBase64 = async (file) => {
  return file.buffer.toString("base64");
};

const formatUserResponse = (user) => {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
    profileComplete: user.profileComplete,
    accountPaused: user.accountPaused,
    photo: user.photo ? `data:image/jpeg;base64,${user.photo}` : null,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
};