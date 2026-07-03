/**
 * GAMIFICATION & ROUTINE SERVICE TESTS
 * Testing: Points, Levels, Achievements, Rewards, Routines, Exercises
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/config/prisma.js');
vi.mock('../src/config/redis.js');

import prisma from '../src/config/prisma.js';
import redis from '../src/config/redis.js';
import * as gamificationService from '../src/services/gamification.service.js';
import * as routineService from '../src/services/routine.service.js';
import * as gamificationController from '../src/controllers/gamification.controller.js';
import * as routineController from '../src/controllers/routine.controller.js';

describe('GAMIFICATION SERVICE TESTS', () => {
  const mockUser = {
    id: 'user-123',
    points: 1000,
    level: 5,
    exp: 5000,
  };

  const mockAchievement = {
    id: 'achievement-1',
    name: 'First Workout',
    description: 'Complete your first workout',
    icon: 'icon-url',
    pointsReward: 100,
    unlockedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Add Points', () => {
    it('should add points to user', async () => {
      const updatedUser = { ...mockUser, points: 1100 };
      prisma.user.update.mockResolvedValue(updatedUser);
      redis.del.mockResolvedValue(1);

      const result = await gamificationService.addPoints('user-123', 100);

      expect(result.points).toBe(1100);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { points: { increment: 100 } },
      });
    });

    it('should not allow negative points', async () => {
      await expect(gamificationService.addPoints('user-123', -100)).rejects.toThrow();
    });

    it('should check for level up', async () => {
      const newLevel = { ...mockUser, level: 6, exp: 6000 };
      prisma.user.update.mockResolvedValue(newLevel);

      const result = await gamificationService.addPoints('user-123', 1000);

      expect(result.level).toBe(6);
    });

    it('should create activity log', async () => {
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.activityLog.create.mockResolvedValue({});

      await gamificationService.addPoints('user-123', 100, 'WORKOUT_COMPLETED');

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: 'WORKOUT_COMPLETED',
          points: 100,
        }),
      });
    });
  });

  describe('Get User Achievements', () => {
    it('should return user achievements', async () => {
      const achievements = [
        { ...mockAchievement, unlockedAt: new Date() },
        { ...mockAchievement, id: 'achievement-2', unlockedAt: null },
      ];
      prisma.userAchievement.findMany.mockResolvedValue(achievements);
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      const result = await gamificationService.getUserAchievements('user-123');

      expect(result).toHaveLength(2);
    });

    it('should include progress for locked achievements', async () => {
      const achievements = [
        { ...mockAchievement, unlockedAt: null, progress: 50, requirement: 100 },
      ];
      prisma.userAchievement.findMany.mockResolvedValue(achievements);
      redis.get.mockResolvedValue(null);

      const result = await gamificationService.getUserAchievements('user-123');

      expect(result[0]).toHaveProperty('progress');
    });
  });

  describe('Unlock Achievement', () => {
    it('should unlock achievement for user', async () => {
      const unlockedAchievement = { ...mockAchievement, unlockedAt: new Date() };
      prisma.userAchievement.update.mockResolvedValue(unlockedAchievement);
      prisma.user.update.mockResolvedValue({});
      redis.del.mockResolvedValue(1);

      const result = await gamificationService.unlockAchievement('user-123', 'achievement-1');

      expect(result.unlockedAt).toBeDefined();
    });

    it('should award points on unlock', async () => {
      prisma.userAchievement.update.mockResolvedValue(mockAchievement);
      prisma.achievement.findUnique.mockResolvedValue(mockAchievement);
      prisma.user.update.mockResolvedValue({});

      await gamificationService.unlockAchievement('user-123', 'achievement-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          points: { increment: mockAchievement.pointsReward },
        },
      });
    });

    it('should not unlock already unlocked achievement', async () => {
      const unlockedAchievement = { ...mockAchievement, unlockedAt: new Date() };
      prisma.userAchievement.findUnique.mockResolvedValue(unlockedAchievement);

      await expect(
        gamificationService.unlockAchievement('user-123', 'achievement-1')
      ).rejects.toThrow();
    });
  });

  describe('Get Leaderboard', () => {
    it('should return top users by points', async () => {
      const leaderboard = [
        { id: 'user-1', points: 5000, level: 10 },
        { id: 'user-2', points: 4500, level: 9 },
      ];
      prisma.user.findMany.mockResolvedValue(leaderboard);
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      const result = await gamificationService.getLeaderboard({ limit: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].points).toBeGreaterThanOrEqual(result[1].points);
    });

    it('should support pagination', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await gamificationService.getLeaderboard({ limit: 10, offset: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('should cache leaderboard', async () => {
      redis.get.mockResolvedValue(JSON.stringify([
        { id: 'user-1', points: 5000 },
      ]));

      await gamificationService.getLeaderboard({ limit: 10 });

      expect(redis.get).toHaveBeenCalledWith('leaderboard:all');
    });
  });

  describe('Get User Level Progress', () => {
    it('should return level and exp progress', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        level: 5,
        exp: 5000,
      });
      redis.get.mockResolvedValue(null);

      const result = await gamificationService.getUserLevelProgress('user-123');

      expect(result).toHaveProperty('level');
      expect(result).toHaveProperty('exp');
      expect(result).toHaveProperty('nextLevelExp');
      expect(result).toHaveProperty('progress');
    });

    it('should calculate progress percentage', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        exp: 5000,
      });

      const result = await gamificationService.getUserLevelProgress('user-123');

      expect(result.progress).toBeGreaterThanOrEqual(0);
      expect(result.progress).toBeLessThanOrEqual(100);
    });
  });

  describe('Get Rewards', () => {
    it('should return available rewards', async () => {
      const rewards = [
        { id: 'reward-1', name: 'Premium Access', cost: 1000 },
        { id: 'reward-2', name: 'Theme Pack', cost: 500 },
      ];
      prisma.reward.findMany.mockResolvedValue(rewards);
      redis.get.mockResolvedValue(null);

      const result = await gamificationService.getAvailableRewards();

      expect(result).toHaveLength(2);
    });

    it('should filter by user points', async () => {
      const affordableRewards = [
        { id: 'reward-2', name: 'Theme Pack', cost: 500 },
      ];
      prisma.reward.findMany.mockResolvedValue(affordableRewards);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await gamificationService.getAvailableRewards('user-123');

      expect(result.every(r => r.cost <= mockUser.points)).toBe(true);
    });
  });

  describe('Redeem Reward', () => {
    it('should redeem reward successfully', async () => {
      const reward = { id: 'reward-1', name: 'Premium', cost: 500 };
      prisma.reward.findUnique.mockResolvedValue(reward);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userReward.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      redis.del.mockResolvedValue(1);

      const result = await gamificationService.redeemReward('user-123', 'reward-1');

      expect(result).toHaveProperty('message');
    });

    it('should check if user has enough points', async () => {
      const reward = { id: 'reward-1', cost: 5000 };
      prisma.reward.findUnique.mockResolvedValue(reward);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(gamificationService.redeemReward('user-123', 'reward-1')).rejects.toThrow(
        'Insufficient points'
      );
    });

    it('should deduct points after redemption', async () => {
      const reward = { id: 'reward-1', cost: 500 };
      prisma.reward.findUnique.mockResolvedValue(reward);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.userReward.create.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      await gamificationService.redeemReward('user-123', 'reward-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { points: { decrement: reward.cost } },
      });
    });
  });
});

describe('ROUTINE SERVICE TESTS', () => {
  const mockRoutine = {
    id: 'routine-123',
    userId: 'user-123',
    name: 'Morning Workout',
    description: 'Daily morning routine',
    difficulty: 'BEGINNER',
    duration: 30,
    exercises: [],
    isActive: true,
    createdAt: new Date(),
  };

  const mockExercise = {
    id: 'exercise-123',
    name: 'Push-ups',
    sets: 3,
    reps: 10,
    weight: null,
    description: 'Standard push-ups',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Routine', () => {
    it('should create a new routine', async () => {
      prisma.routine.create.mockResolvedValue(mockRoutine);
      redis.del.mockResolvedValue(1);

      const result = await routineService.createRoutine('user-123', {
        name: 'Morning Workout',
        difficulty: 'BEGINNER',
        duration: 30,
      });

      expect(result).toEqual(mockRoutine);
      expect(prisma.routine.create).toHaveBeenCalled();
    });

    it('should validate routine name', async () => {
      await expect(
        routineService.createRoutine('user-123', {
          name: '',
          difficulty: 'BEGINNER',
        })
      ).rejects.toThrow();
    });

    it('should validate difficulty level', async () => {
      await expect(
        routineService.createRoutine('user-123', {
          name: 'Test',
          difficulty: 'INVALID',
        })
      ).rejects.toThrow();
    });
  });

  describe('Get User Routines', () => {
    it('should retrieve all user routines', async () => {
      const routines = [mockRoutine, { ...mockRoutine, id: 'routine-456' }];
      prisma.routine.findMany.mockResolvedValue(routines);
      redis.get.mockResolvedValue(null);

      const result = await routineService.getUserRoutines('user-123');

      expect(result).toHaveLength(2);
    });

    it('should filter by active status', async () => {
      prisma.routine.findMany.mockResolvedValue([mockRoutine]);

      await routineService.getUserRoutines('user-123', { active: true });

      expect(prisma.routine.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: true,
        }),
      });
    });
  });

  describe('Add Exercise to Routine', () => {
    it('should add exercise to routine', async () => {
      prisma.routineExercise.create.mockResolvedValue({
        ...mockExercise,
        routineId: 'routine-123',
      });
      redis.del.mockResolvedValue(1);

      const result = await routineService.addExerciseToRoutine('routine-123', {
        name: 'Push-ups',
        sets: 3,
        reps: 10,
      });

      expect(result).toHaveProperty('name', 'Push-ups');
    });

    it('should validate exercise data', async () => {
      await expect(
        routineService.addExerciseToRoutine('routine-123', {
          name: '',
          sets: 'invalid',
        })
      ).rejects.toThrow();
    });

    it('should check routine exists', async () => {
      prisma.routine.findUnique.mockResolvedValue(null);

      await expect(
        routineService.addExerciseToRoutine('nonexistent', {
          name: 'Push-ups',
          sets: 3,
          reps: 10,
        })
      ).rejects.toThrow('Routine not found');
    });
  });

  describe('Update Routine', () => {
    it('should update routine details', async () => {
      const updated = { ...mockRoutine, name: 'Evening Workout' };
      prisma.routine.update.mockResolvedValue(updated);
      redis.del.mockResolvedValue(1);

      const result = await routineService.updateRoutine('routine-123', {
        name: 'Evening Workout',
      });

      expect(result.name).toBe('Evening Workout');
    });

    it('should invalidate cache after update', async () => {
      prisma.routine.update.mockResolvedValue(mockRoutine);
      redis.del.mockResolvedValue(1);

      await routineService.updateRoutine('routine-123', { name: 'Updated' });

      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('Delete Routine', () => {
    it('should delete routine', async () => {
      prisma.routine.delete.mockResolvedValue(mockRoutine);
      redis.del.mockResolvedValue(1);

      const result = await routineService.deleteRoutine('routine-123');

      expect(result).toHaveProperty('message');
    });

    it('should delete all associated exercises', async () => {
      prisma.routineExercise.deleteMany.mockResolvedValue({ count: 5 });
      prisma.routine.delete.mockResolvedValue(mockRoutine);

      await routineService.deleteRoutine('routine-123');

      expect(prisma.routineExercise.deleteMany).toHaveBeenCalled();
    });
  });

  describe('Get Routine Exercises', () => {
    it('should return routine exercises', async () => {
      const exercises = [mockExercise, { ...mockExercise, id: 'exercise-456' }];
      prisma.routineExercise.findMany.mockResolvedValue(exercises);

      const result = await routineService.getRoutineExercises('routine-123');

      expect(result).toHaveLength(2);
    });

    it('should order exercises by sequence', async () => {
      prisma.routineExercise.findMany.mockResolvedValue([mockExercise]);

      await routineService.getRoutineExercises('routine-123');

      expect(prisma.routineExercise.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.any(Object),
        })
      );
    });
  });
});

describe('GAMIFICATION CONTROLLER TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'user-123' }, body: {}, validatedData: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Get Achievements Controller', () => {
    it('should return user achievements', async () => {
      vi.spyOn(gamificationService, 'getUserAchievements').mockResolvedValue([]);

      await gamificationController.getAchievements(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Get Leaderboard Controller', () => {
    it('should return leaderboard', async () => {
      vi.spyOn(gamificationService, 'getLeaderboard').mockResolvedValue([]);

      await gamificationController.getLeaderboard(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });
});

describe('ROUTINE CONTROLLER TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: 'user-123' }, params: {}, body: {}, validatedData: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Create Routine Controller', () => {
    it('should create routine with 201 status', async () => {
      vi.spyOn(routineService, 'createRoutine').mockResolvedValue({
        id: 'routine-123',
      });

      await routineController.createRoutine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('Get Routines Controller', () => {
    it('should return user routines', async () => {
      vi.spyOn(routineService, 'getUserRoutines').mockResolvedValue([]);

      await routineController.getUserRoutines(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });
});