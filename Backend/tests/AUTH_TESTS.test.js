/**
 * AUTH SERVICE & CONTROLLER TESTS
 * Testing: Register, Login, Logout, Refresh Token, Password Reset, Me endpoint
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../src/config/prisma.js');
vi.mock('../src/config/redis.js');
vi.mock('../src/services/communication.service.js');
vi.mock('bcrypt');
vi.mock('jsonwebtoken');

import prisma from '../src/config/prisma.js';
import redis from '../src/config/redis.js';
import * as authService from '../src/services/auth.service.js';
import * as authController from '../src/controllers/auth.controller.js';
import { AppError } from '../src/utils/errors.js';

describe('AUTH SERVICE TESTS', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'USER',
    isActive: true,
    passwordHash: 'hashed_password',
  };

  const mockUserData = {
    email: 'test@example.com',
    password: 'TestPassword123',
    firstName: 'John',
    lastName: 'Doe',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Register', () => {
    it('should register a new user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashed_password');
      jwt.sign.mockReturnValue('token');

      const result = await authService.register(mockUserData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(mockUserData.email);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw error if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(authService.register(mockUserData)).rejects.toThrow('Email already in use');
    });

    it('should hash password with bcrypt', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashed_password');

      await authService.register(mockUserData);

      expect(bcrypt.hash).toHaveBeenCalledWith(mockUserData.password, 10);
    });

    it('should create user with role USER by default', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      bcrypt.hash.mockResolvedValue('hashed_password');

      await authService.register(mockUserData);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'USER',
          email: mockUserData.email,
        }),
      });
    });
  });

  describe('Login', () => {
    it('should login user successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token');

      const result = await authService.login({
        email: mockUserData.email,
        password: mockUserData.password,
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error for invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'wrong@example.com',
          password: 'wrongpass',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      prisma.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(
        authService.login({
          email: mockUserData.email,
          password: mockUserData.password,
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        authService.login({
          email: mockUserData.email,
          password: 'wrongpass',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should compare passwords correctly', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token');

      await authService.login({
        email: mockUserData.email,
        password: mockUserData.password,
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(mockUserData.password, mockUser.passwordHash);
    });
  });

  describe('Refresh Token', () => {
    it('should refresh token successfully', async () => {
      jwt.verify.mockReturnValue({ userId: 'user-123' });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('new_token');

      const result = await authService.refreshToken('old_refresh_token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw error for invalid refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken('invalid_token')).rejects.toThrow();
    });

    it('should throw error if user not found', async () => {
      jwt.verify.mockReturnValue({ userId: 'nonexistent' });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.refreshToken('valid_token')).rejects.toThrow();
    });
  });

  describe('Logout', () => {
    it('should logout user successfully', async () => {
      redis.setex.mockResolvedValue('OK');

      const result = await authService.logout('token');

      expect(redis.setex).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should add token to blacklist', async () => {
      redis.setex.mockResolvedValue('OK');

      await authService.logout('token123');

      expect(redis.setex).toHaveBeenCalledWith('blacklist:token123', expect.any(Number), '1');
    });
  });

  describe('Me Endpoint', () => {
    it('should return current user profile', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.me('user-123');

      expect(result).toEqual(expect.not.objectContaining({
        passwordHash: expect.anything(),
      }));
      expect(result.id).toBe('user-123');
    });

    it('should throw error if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.me('nonexistent')).rejects.toThrow();
    });
  });

  describe('Password Reset', () => {
    it('should initiate password reset', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await authService.forgotPassword({ email: mockUserData.email });

      expect(prisma.user.update).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Password reset email sent' });
    });

    it('should throw error for non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.forgotPassword({ email: 'nonexistent@example.com' })).rejects.toThrow();
    });

    it('should reset password with valid token', async () => {
      const resetToken = 'reset_token_123';
      const hashedToken = 'hashed_reset_token';
      
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordResetToken: hashedToken,
        passwordResetExpires: new Date(Date.now() + 3600000),
      });
      
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('new_hashed_password');
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await authService.resetPassword({
        token: resetToken,
        newPassword: 'NewPassword123',
      });

      expect(result).toEqual(expect.objectContaining({ message: 'Password reset successfully' }));
    });

    it('should throw error for expired reset token', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordResetExpires: new Date(Date.now() - 1000),
      });

      await expect(authService.resetPassword({
        token: 'expired_token',
        newPassword: 'NewPassword123',
      })).rejects.toThrow('Token expired');
    });
  });
});

describe('AUTH CONTROLLER TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      validatedData: mockUserData,
      user: { id: 'user-123' },
      headers: { authorization: 'Bearer token123' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Register Controller', () => {
    it('should return 201 on successful registration', async () => {
      vi.spyOn(authService, 'register').mockResolvedValue({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      await authController.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it('should call next with error on failure', async () => {
      const error = new Error('Registration failed');
      vi.spyOn(authService, 'register').mockRejectedValue(error);

      await authController.register(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('Login Controller', () => {
    it('should return tokens on successful login', async () => {
      vi.spyOn(authService, 'login').mockResolvedValue({
        user: mockUser,
        accessToken: 'token',
        refreshToken: 'refresh',
      });

      await authController.login(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          accessToken: 'token',
        }),
      });
    });
  });

  describe('Logout Controller', () => {
    it('should logout user and return success', async () => {
      vi.spyOn(authService, 'logout').mockResolvedValue({ message: 'Logged out' });

      await authController.logout(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Logged out' },
      });
    });
  });

  describe('Me Controller', () => {
    it('should return current user profile', async () => {
      vi.spyOn(authService, 'me').mockResolvedValue(mockUser);

      await authController.me(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });
  });
});