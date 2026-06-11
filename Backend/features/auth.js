import { prisma } from '../db.js';
import { generateTokens, verifyToken } from '../utils/jwt.js';
import { sendEmail } from '../utils/email.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@fitness-app.com';

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

export const authController = {
  async register(req, res) { 
    try {
      const { email, password, fullName, username } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(password); // Ahora usa bcrypt real

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          username,
          verificationToken,
          verificationTokenExpiry,
          emailVerified: false,
        },
      });

      // Send verification email
      await sendEmail({
        to: email,
        from: EMAIL_FROM,
        subject: 'Verify Your Email',
        html: `
          <h1>Welcome to Gym App!</h1>
          <p>Please verify your email by clicking the link below:</p>
          <a href="${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}">
            Verify Email
          </a>
        `,
      });

      return res.status(201).json({
        message: 'User registered. Please check your email to verify.',
        userId: user.id,
      });
    } catch (error) {
      return res.status(500).json({ error: 'Registration failed' });
    }
  },

  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          verificationToken: token,
          verificationTokenExpiry: { gt: new Date() },
        },
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
        },
      });

      return res.status(200).json({ message: 'Email verified successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Email verification failed' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      const passwordMatch = await verifyPassword(password, user.password);
        if (!passwordMatch) {
        return res.status(401).json({ error: 'invalid_credentials' });
      }

      const { accessToken, refreshToken } = generateTokens(user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });

      return res.status(200).json({
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, fullName: user.fullName },
      });
    } catch (error) {
      return res.status(500).json({ error: 'Login failed' });
    }
  },

  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });

      await sendEmail({
        to: email,
        from: EMAIL_FROM,
        subject: 'Reset Your Password',
        html: `
          <h1>Password Reset Request</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}">
            Reset Password
          </a>
        `,
      });

      return res.status(200).json({ message: 'Password reset email sent' });
    } catch (error) {
      return res.status(500).json({ error: 'Password reset request failed' });
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: { gt: new Date() },
        },
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const hashedPassword = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      return res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Password reset failed' });
    }
  },

  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.id;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !(await comparePassword(oldPassword, user.password))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      return res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      return res.status(500).json({ error: 'Password change failed' });
    }
  },

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      const decoded = verifyToken(refreshToken, 'refresh');
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).json({ error: 'Refresh token mismatch' });
      }

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id);

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: newRefreshToken },
      });

      return res.status(200).json({ accessToken, refreshToken: newRefreshToken });
    } catch (error) {
      return res.status(500).json({ error: 'Token refresh failed' });
    }
  },
};

export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function comparePassword(password, hash) {
  // Use bcrypt in real implementation
  return password === hash; // Placeholder
}

export const loginByQR = async (req, res) => {
  const { personalQRCode } = req.body;

  try {
    const qr = await prisma.qrCode.findUnique({
      where: { code: personalQRCode },
      include: { user: true }
    });

    if (!qr || qr.type !== 'PERSONAL' || !qr.isActive) {
      return res.status(401).json({
        error: "Invalid or expired QR code",
        code: ERROR_CODES.INVALID_CREDENTIALS,
      });
    }

    if (!qr.user.emailVerified) {
      return res.status(403).json({
        error: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const { accessToken, refreshToken } = generateTokens(qr.user);

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: qr.user.id,
        email: qr.user.email,
        fullName: qr.user.fullName,
        role: qr.user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("[AUTH] Login by QR error:", error);
    return res.status(500).json({
      error: "Login failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    await sendEmail({
      to: email,
      from: EMAIL_FROM,
      subject: "Reset Your Password",
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password (valid for 1 hour):</p>
        <a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}">
          Reset Password
        </a>
        <p>If you didn't request this, ignore this email.</p>
      `,
    });

    return res.status(200).json({
      message: "Password reset email sent",
    });
  } catch (error) {
    console.error("[AUTH] Request password reset error:", error);
    return res.status(500).json({
      error: "Failed to send reset email",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        error: "Invalid or expired reset token",
        code: ERROR_CODES.VALIDATION_ERROR,
      });
    }

    user.password = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("[AUTH] Reset password error:", error);
    return res.status(500).json({
      error: "Failed to reset password",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const isPasswordValid = await verifyPassword(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Current password is incorrect",
        code: ERROR_CODES.INVALID_CREDENTIALS,
      });
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
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

export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}