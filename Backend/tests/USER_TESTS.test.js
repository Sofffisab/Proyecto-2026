/**
 * USER SERVICE & CONTROLLER TESTS
 * Testing: Profile Management, User Updates, User Deletion, Preferences
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/config/prisma.js');
vi.mock('../src/config/redis.js');

import prisma from '../src/config/prisma.js';
import redis from '../src/config/redis.js';
import * as userService from '../src/services/user.service.js';
import * as userController from '../src/controllers/user.controller.js';

describe('USER SERVICE TESTS', () => {
  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    avatar: 'https://example.com/avatar.jpg',
    bio: 'I love fitness',
    points: 1000,
    level: 5,
    isActive: true,
    role: 'USER',
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Get User Profile', () => {
    it('should retrieve user profile by ID', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.getProfile('user-123');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should throw error for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.getProfile('nonexistent')).rejects.toThrow();
    });

    it('should cache user profile in Redis', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      await userService.getProfile('user-123');

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining('user-123'),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('Update User Profile', () => {
    it('should update user profile successfully', async () => {
      const updateData = { firstName: 'Jane', bio: 'New bio' };
      const updatedUser = { ...mockUser, ...updateData };
      prisma.user.update.mockResolvedValue(updatedUser);
      redis.del.mockResolvedValue(1);

      const result = await userService.updateProfile('user-123', updateData);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData,
      });
    });

    it('should invalidate cache after update', async () => {
      const updateData = { firstName: 'Jane' };
      prisma.user.update.mockResolvedValue(mockUser);
      redis.del.mockResolvedValue(1);

      await userService.updateProfile('user-123', updateData);

      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('user-123'));
    });

    it('should validate email format on update', async () => {
      const invalidData = { email: 'invalid-email' };

      await expect(userService.updateProfile('user-123', invalidData)).rejects.toThrow();
    });

    it('should not allow duplicate email', async () => {
      const existingUser = { ...mockUser, id: 'user-456', email: 'existing@example.com' };
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        userService.updateProfile('user-123', { email: 'existing@example.com' })
      ).rejects.toThrow();
    });
  });

  describe('Delete User Account', () => {
    it('should delete user account successfully', async () => {
      prisma.user.delete.mockResolvedValue(mockUser);
      redis.del.mockResolvedValue(1);

      const result = await userService.deleteAccount('user-123');

      expect(result).toEqual({ message: 'Account deleted successfully' });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should clear Redis cache on deletion', async () => {
      prisma.user.delete.mockResolvedValue(mockUser);
      redis.del.mockResolvedValue(1);

      await userService.deleteAccount('user-123');

      expect(redis.del).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      prisma.user.delete.mockRejectedValue(new Error('Record not found'));

      await expect(userService.deleteAccount('nonexistent')).rejects.toThrow();
    });
  });

  describe('User Search', () => {
    it('should search users by name', async () => {
      const searchResults = [mockUser, { ...mockUser, id: 'user-456' }];
      prisma.user.findMany.mockResolvedValue(searchResults);

      const result = await userService.searchUsers('John');

      expect(result).toHaveLength(2);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { firstName: { contains: 'John', mode: 'insensitive' } },
            { lastName: { contains: 'John', mode: 'insensitive' } },
            { email: { contains: 'John', mode: 'insensitive' } },
          ],
        },
      });
    });

    it('should limit search results', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);

      await userService.searchUsers('John', { limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe('Get User Statistics', () => {
    it('should return user statistics', async () => {
      const stats = {
        totalPoints: 1000,
        currentLevel: 5,
        completedChallenges: 15,
        totalWorkouts: 45,
      };

      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        challenges: Array(15).fill({}),
      });
      prisma.workout.count.mockResolvedValue(45);

      const result = await userService.getStats('user-123');

      expect(result).toHaveProperty('points');
      expect(result).toHaveProperty('level');
    });
  });

  describe('Get User Leaderboard Position', () => {
    it('should return user leaderboard rank', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', points: 5000 },
        { id: 'user-123', points: 1000 },
      ]);

      const result = await userService.getLeaderboardRank('user-123');

      expect(result).toHaveProperty('rank');
      expect(result).toHaveProperty('points');
    });

    it('should return correct ranking', async () => {
      prisma.user.findMany.mockResolvedValue(Array(100).fill({}).map((_, i) => ({
        id: `user-${i}`,
        points: 5000 - (i * 10),
      })));

      const result = await userService.getLeaderboardRank('user-50');

      expect(result.rank).toBeGreaterThan(1);
    });
  });

  describe('Update User Preferences', () => {
    it('should update user preferences', async () => {
      const preferences = {
        emailNotifications: false,
        pushNotifications: true,
        theme: 'dark',
      };

      prisma.userPreferences.upsert.mockResolvedValue(preferences);

      const result = await userService.updatePreferences('user-123', preferences);

      expect(result).toEqual(preferences);
    });

    it('should validate preference values', async () => {
      const invalidPreferences = {
        theme: 'invalid-theme',
      };

      await expect(userService.updatePreferences('user-123', invalidPreferences)).rejects.toThrow();
    });
  });
});

describe('USER CONTROLLER TESTS', () => {
  let req, res, next;

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    firstName: 'John',
  };

  beforeEach(() => {
    req = {
      user: { id: 'user-123' },
      params: { id: 'user-123' },
      body: {},
      validatedData: {},
    };
    res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Get Profile Controller', () => {
    it('should return user profile', async () => {
      vi.spyOn(userService, 'getProfile').mockResolvedValue(mockUser);

      await userController.getProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser,
      });
    });

    it('should handle user not found', async () => {
      vi.spyOn(userService, 'getProfile').mockRejectedValue(new Error('Not found'));

      await userController.getProfile(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Update Profile Controller', () => {
    it('should update user profile', async () => {
      req.validatedData = { firstName: 'Jane' };
      vi.spyOn(userService, 'updateProfile').mockResolvedValue({
        ...mockUser,
        firstName: 'Jane',
      });

      await userController.updateProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ firstName: 'Jane' }),
      });
    });
  });

  describe('Delete Account Controller', () => {
    it('should delete user account', async () => {
      vi.spyOn(userService, 'deleteAccount').mockResolvedValue({ message: 'Deleted' });

      await userController.deleteAccount(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ message: 'Deleted' }),
      });
    });
  });

  describe('Get Statistics Controller', () => {
    it('should return user statistics', async () => {
      vi.spyOn(userService, 'getStats').mockResolvedValue({
        points: 1000,
        level: 5,
      });

      await userController.getStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ points: 1000 }),
      });
    });
  });

  describe('Leaderboard Controller', () => {
    it('should return leaderboard', async () => {
      vi.spyOn(userService, 'getLeaderboard').mockResolvedValue([
        { id: 'user-1', points: 5000, rank: 1 },
        { id: 'user-2', points: 4500, rank: 2 },
      ]);

      await userController.getLeaderboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array),
      });
    });
  });
});