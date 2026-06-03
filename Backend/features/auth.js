import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma.js";
import {
  validateEmail,
  validatePassword,
  validateUsername,
  ERROR_CODES,
} from "../shared/utils.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is required");
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    {
      userId: user.id,
      tokenVersion: user.tokenVersion,
      type: "refresh",
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

// ============ REGISTER ============

export const register = async (req, res) => {
  const { email, password, fullName, username } = req.body;

  if (!email || !password || !fullName || !username) {
    return res.status(400).json({
      error: "All fields are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({
      error: "Invalid email format",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters with uppercase, lowercase, and number",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!validateUsername(username)) {
    return res.status(400).json({
      error:
        "Username must be 3-20 characters and contain only letters, numbers, and underscores",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        fullName,
        username: username.toLowerCase(),
        profile: { create: {} },
        settings: { create: {} },
        userPoints: { create: {} },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
        tokenVersion: true,
      },
    });

    const tokens = generateTokens(user);

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
      },
      ...tokens,
    });
  } catch (error) {
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0];
      return res.status(409).json({
        error: `A user with this ${field} already exists`,
        code: ERROR_CODES.DUPLICATE_ENTRY,
        field,
      });
    }
    console.error("[AUTH] Register error:", error);
    return res.status(500).json({
      error: "Registration failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ LOGIN ============

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        fullName: true,
        username: true,
        role: true,
        photoUrl: true,
        profileComplete: true,
        accountPaused: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        code: ERROR_CODES.INVALID_CREDENTIALS,
      });
    }

    if (user.accountPaused) {
      return res.status(403).json({
        error: "Account is paused. Contact support.",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid credentials",
        code: ERROR_CODES.INVALID_CREDENTIALS,
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = generateTokens(user);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
        photoUrl: user.photoUrl,
        profileComplete: user.profileComplete,
      },
      ...tokens,
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    return res.status(500).json({
      error: "Login failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ LOGOUT ============

export const logout = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    return res.status(200).json({
      message: "Logout successful",
    });
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    return res.status(500).json({
      error: "Logout failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ REFRESH TOKEN ============

export const refreshToken = async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    return res.status(400).json({
      error: "Refresh token is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== "refresh") {
      return res.status(401).json({
        error: "Invalid token type",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
        accountPaused: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "User not found",
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        error: "Token has been invalidated",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    if (user.accountPaused) {
      return res.status(403).json({
        error: "Account is paused",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    const tokens = generateTokens(user);

    return res.status(200).json({
      message: "Token refreshed",
      ...tokens,
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Refresh token expired",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }
    console.error("[AUTH] Refresh token error:", error);
    return res.status(401).json({
      error: "Invalid refresh token",
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }
};

// ============ CHANGE PASSWORD ============

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: "Current password and new password are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!validatePassword(newPassword)) {
    return res.status(400).json({
      error:
        "New password must be at least 8 characters with uppercase, lowercase, and number",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { password: true },
    });

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Current password is incorrect",
        code: ERROR_CODES.INVALID_CREDENTIALS,
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("[AUTH] Change password error:", error);
    return res.status(500).json({
      error: "Failed to change password",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ REQUEST PASSWORD RESET ============

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: "Email is required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(200).json({
        message: "If the email exists, a reset link has been sent",
      });
    }

    const resetToken = jwt.sign(
      { userId: user.id, type: "reset" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log(`[AUTH] Password reset token for ${email}: ${resetToken}`);

    return res.status(200).json({
      message: "If the email exists, a reset link has been sent",
    });
  } catch (error) {
    console.error("[AUTH] Request password reset error:", error);
    return res.status(500).json({
      error: "Failed to process request",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ RESET PASSWORD ============

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      error: "Token and new password are required",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  if (!validatePassword(newPassword)) {
    return res.status(400).json({
      error:
        "Password must be at least 8 characters with uppercase, lowercase, and number",
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== "reset") {
      return res.status(401).json({
        error: "Invalid token type",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    return res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Reset token expired",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }
    console.error("[AUTH] Reset password error:", error);
    return res.status(401).json({
      error: "Invalid reset token",
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }
};

// ============ VALIDATE TOKEN ============

export const validate = async (req, res) => {
  try {
    return res.status(200).json({
      valid: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        fullName: req.user.fullName,
        username: req.user.username,
        role: req.user.role,
        photoUrl: req.user.photoUrl,
        profileComplete: req.user.profileComplete,
      },
    });
  } catch (error) {
    console.error("[AUTH] Validate error:", error);
    return res.status(500).json({
      error: "Validation failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};