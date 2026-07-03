/**
 * CHALLENGE SERVICE & CONTROLLER TESTS
 * Testing: Challenge Creation, Completion, Progress, Leaderboards
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/config/prisma.js');
vi.mock('../src/config/redis.js');

import prisma from '../src/config/prisma.js';
import redis from '../src/config/redis.js';
import * as challengeService from '../src/services/challenge.service.js';
import * as challengeController from '../src/controllers/challenge.controller.js';

describe('CHALLENGE SERVICE TESTS', () => {
  const mockChallenge = {
    id: 'challenge-123',
    title: '30 Day Fitness Challenge',
    description: 'Complete 30 days of workouts',
    difficulty: 'MEDIUM',
    duration: 30,
    pointsReward: 500,
    category: 'FITNESS',
    status: 'ACTIVE',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    createdAt: new Date(),
  };

  const mockParticipant = {
    id: 'participant-123',
    userId: 'user-123',
    challengeId: 'challenge-123',
    progress: 15,
    completedAt: null,
    joinedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Challenge', () => {
    it('should create a new challenge', async () => {
      prisma.challenge.create.mockResolvedValue(mockChallenge);
      redis.del.mockResolvedValue(1);

      const result = await challengeService.createChallenge({
        title: '30 Day Fitness Challenge',
        description: 'Complete 30 days of workouts',
        difficulty: 'MEDIUM',
        duration: 30,
        pointsReward: 500,
      });

      expect(result).toEqual(mockChallenge);
      expect(prisma.challenge.create).toHaveBeenCalled();
    });

    it('should validate challenge data', async () => {
      const invalidData = {
        title: '',
        description: 'Test',
        difficulty: 'INVALID',
      };

      await expect(challengeService.createChallenge(invalidData)).rejects.toThrow();
    });

    it('should set correct default values', async () => {
      prisma.challenge.create.mockResolvedValue({
        ...mockChallenge,
        status: 'ACTIVE',
      });

      await challengeService.createChallenge({
        title: 'Test',
        difficulty: 'EASY',
        duration: 7,
      });

      expect(prisma.challenge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'ACTIVE',
        }),
      });
    });
  });

  describe('Get Challenge', () => {
    it('should retrieve challenge by ID', async () => {
      prisma.challenge.findUnique.mockResolvedValue(mockChallenge);
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      const result = await challengeService.getChallengeById('challenge-123');

      expect(result).toEqual(mockChallenge);
    });

    it('should cache challenge in Redis', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockChallenge));

      const result = await challengeService.getChallengeById('challenge-123');

      expect(result).toEqual(mockChallenge);
      expect(redis.get).toHaveBeenCalledWith('challenge:challenge-123');
    });

    it('should throw error for non-existent challenge', async () => {
      redis.get.mockResolvedValue(null);
      prisma.challenge.findUnique.mockResolvedValue(null);

      await expect(challengeService.getChallengeById('nonexistent')).rejects.toThrow();
    });
  });

  describe('Join Challenge', () => {
    it('should allow user to join challenge', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue(null);
      prisma.challengeParticipant.create.mockResolvedValue(mockParticipant);
      redis.del.mockResolvedValue(1);

      const result = await challengeService.joinChallenge('user-123', 'challenge-123');

      expect(result).toHaveProperty('userId', 'user-123');
      expect(result).toHaveProperty('challengeId', 'challenge-123');
    });

    it('should prevent duplicate join', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue(mockParticipant);

      await expect(
        challengeService.joinChallenge('user-123', 'challenge-123')
      ).rejects.toThrow('Already joined');
    });

    it('should check challenge is active', async () => {
      const expiredChallenge = { ...mockChallenge, status: 'COMPLETED' };
      prisma.challenge.findUnique.mockResolvedValue(expiredChallenge);

      await expect(
        challengeService.joinChallenge('user-123', 'challenge-123')
      ).rejects.toThrow('Challenge not active');
    });
  });

  describe('Update Challenge Progress', () => {
    it('should update participant progress', async () => {
      const updatedParticipant = { ...mockParticipant, progress: 20 };
      prisma.challengeParticipant.update.mockResolvedValue(updatedParticipant);
      redis.del.mockResolvedValue(1);

      const result = await challengeService.updateProgress('participant-123', 20);

      expect(result.progress).toBe(20);
    });

    it('should complete challenge when progress reaches 100%', async () => {
      prisma.challenge.findUnique.mockResolvedValue(mockChallenge);
      prisma.challengeParticipant.update.mockResolvedValue({
        ...mockParticipant,
        progress: 100,
        completedAt: new Date(),
      });
      prisma.user.update.mockResolvedValue({});

      const result = await challengeService.updateProgress('participant-123', 100);

      expect(result.completedAt).toBeDefined();
    });

    it('should award points on completion', async () => {
      prisma.challengeParticipant.findUnique.mockResolvedValue({
        ...mockParticipant,
        progress: 100,
      });
      prisma.challenge.findUnique.mockResolvedValue(mockChallenge);
      prisma.user.update.mockResolvedValue({});

      await challengeService.updateProgress('participant-123', 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          points: { increment: mockChallenge.pointsReward },
        },
      });
    });
  });

  describe('Get Challenge Leaderboard', () => {
    it('should return challenge leaderboard', async () => {
      const leaderboard = [
        { rank: 1, userId: 'user-1', progress: 100, points: 500 },
        { rank: 2, userId: 'user-2', progress: 85, points: 425 },
      ];
      prisma.challengeParticipant.findMany.mockResolvedValue(leaderboard);
      redis.get.mockResolvedValue(null);
      redis.setex.mockResolvedValue('OK');

      const result = await challengeService.getChallengeLeaderboard('challenge-123');

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
    });

    it('should cache leaderboard', async () => {
      redis.get.mockResolvedValue(JSON.stringify([
        { rank: 1, userId: 'user-1', progress: 100 },
      ]));

      const result = await challengeService.getChallengeLeaderboard('challenge-123');

      expect(result).toHaveLength(1);
      expect(redis.get).toHaveBeenCalledWith('leaderboard:challenge-123');
    });
  });

  describe('Get Active Challenges', () => {
    it('should retrieve all active challenges', async () => {
      const challenges = [mockChallenge, { ...mockChallenge, id: 'challenge-456' }];
      prisma.challenge.findMany.mockResolvedValue(challenges);
      redis.get.mockResolvedValue(null);

      const result = await challengeService.getActiveChallenges();

      expect(result).toHaveLength(2);
      expect(prisma.challenge.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
      });
    });

    it('should support pagination', async () => {
      prisma.challenge.findMany.mockResolvedValue([mockChallenge]);

      await challengeService.getActiveChallenges({ page: 2, limit: 10 });

      expect(prisma.challenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should support filtering by difficulty', async () => {
      prisma.challenge.findMany.mockResolvedValue([mockChallenge]);

      await challengeService.getActiveChallenges({ difficulty: 'MEDIUM' });

      expect(prisma.challenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            difficulty: 'MEDIUM',
          }),
        })
      );
    });
  });

  describe('Leave Challenge', () => {
    it('should allow user to leave challenge', async () => {
      prisma.challengeParticipant.delete.mockResolvedValue(mockParticipant);
      redis.del.mockResolvedValue(1);

      const result = await challengeService.leaveChallenge('user-123', 'challenge-123');

      expect(result).toHaveProperty('message');
    });

    it('should not allow leaving if already completed', async () => {
      const completedParticipant = { ...mockParticipant, completedAt: new Date() };
      prisma.challengeParticipant.findUnique.mockResolvedValue(completedParticipant);

      await expect(
        challengeService.leaveChallenge('user-123', 'challenge-123')
      ).rejects.toThrow('Cannot leave completed challenge');
    });
  });
});

describe('CHALLENGE CONTROLLER TESTS', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: 'user-123' },
      params: { id: 'challenge-123' },
      body: {},
      validatedData: {},
      query: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('Create Challenge Controller', () => {
    it('should create challenge with 201 status', async () => {
      req.validatedData = {
        title: '30 Day Challenge',
        difficulty: 'MEDIUM',
        duration: 30,
      };
      vi.spyOn(challengeService, 'createChallenge').mockResolvedValue({
        id: 'challenge-123',
        ...req.validatedData,
      });

      await challengeController.createChallenge(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('Get Challenge Controller', () => {
    it('should return challenge details', async () => {
      const mockChallenge = { id: 'challenge-123', title: 'Test' };
      vi.spyOn(challengeService, 'getChallengeById').mockResolvedValue(mockChallenge);

      await challengeController.getChallenge(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockChallenge,
      });
    });
  });

  describe('Join Challenge Controller', () => {
    it('should join challenge successfully', async () => {
      vi.spyOn(challengeService, 'joinChallenge').mockResolvedValue({
        userId: 'user-123',
        challengeId: 'challenge-123',
      });

      await challengeController.joinChallenge(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object),
      });
    });
  });

  describe('Update Progress Controller', () => {
    it('should update progress successfully', async () => {
      req.validatedData = { progress: 50 };
      vi.spyOn(challengeService, 'updateProgress').mockResolvedValue({
        progress: 50,
      });

      await challengeController.updateProgress(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ progress: 50 }),
      });
    });
  });

  describe('Get Leaderboard Controller', () => {
    it('should return challenge leaderboard', async () => {
      const leaderboard = [
        { rank: 1, userId: 'user-1', progress: 100 },
      ];
      vi.spyOn(challengeService, 'getChallengeLeaderboard').mockResolvedValue(leaderboard);

      await challengeController.getLeaderboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: leaderboard,
      });
    });
  });
});