import { prisma } from '../../../src/config/database.js';
import * as gamificationService from '../../../src/services/gamification.service.js';
import { users } from '../../fixtures/index.js';

jest.mock('../../../src/config/database.js');

describe('Gamification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createChallenge', () => {
    it('should create a new challenge', async () => {
      const challenge = {
        id: 'challenge-001',
        initiatorId: users.regularUser.id,
        receiverId: users.trainerUser.id,
        machineId: 'machine-001',
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      prisma.challenge.create.mockResolvedValue(challenge);

      const result = await gamificationService.createChallenge(
        users.regularUser.id,
        users.trainerUser.id,
        'machine-001'
      );

      expect(result).toEqual(challenge);
      expect(prisma.challenge.create).toHaveBeenCalled();
    });
  });

  describe('respondChallenge', () => {
    it('should accept challenge', async () => {
      const updated = {
        id: 'challenge-001',
        status: 'accepted',
      };

      prisma.challenge.update.mockResolvedValue(updated);

      const result = await gamificationService.respondChallenge(
        'challenge-001',
        true
      );

      expect(result.status).toBe('accepted');
    });

    it('should reject challenge', async () => {
      const updated = {
        id: 'challenge-001',
        status: 'rejected',
      };

      prisma.challenge.update.mockResolvedValue(updated);

      const result = await gamificationService.respondChallenge(
        'challenge-001',
        false
      );

      expect(result.status).toBe('rejected');
    });
  });

  describe('completeChallenge', () => {
    it('should mark challenge as completed and award points', async () => {
      const completed = {
        id: 'challenge-001',
        status: 'completed',
        pointsAwarded: 75,
      };

      prisma.challenge.update.mockResolvedValue(completed);

      const result = await gamificationService.completeChallenge('challenge-001');

      expect(result.status).toBe('completed');
      expect(result.pointsAwarded).toBe(75);
    });
  });

  describe('claimReward', () => {
    it('should create reward claim', async () => {
      const claim = {
        id: 'claim-001',
        userId: users.regularUser.id,
        rewardId: 'reward-001',
        status: 'pending',
      };

      prisma.rewardClaim.create.mockResolvedValue(claim);

      const result = await gamificationService.claimReward(
        users.regularUser.id,
        'reward-001'
      );

      expect(result.status).toBe('pending');
    });

    it('should throw error if insufficient points', async () => {
      prisma.userPoints.findUnique.mockResolvedValue({ currentPoints: 10 });
      prisma.reward.findUnique.mockResolvedValue({ pointsCost: 500 });

      await expect(
        gamificationService.claimReward(users.regularUser.id, 'reward-001')
      ).rejects.toThrow('Insufficient points');
    });
  });

  describe('createComplaint', () => {
    it('should create complaint', async () => {
      const complaint = {
        id: 'complaint-001',
        submittedBy: users.regularUser.id,
        targetId: users.trainerUser.id,
        targetRole: 'TRAINER',
        type: 'false_machine_presence',
        status: 'pending',
      };

      prisma.complaint.create.mockResolvedValue(complaint);

      const result = await gamificationService.createComplaint(
        users.regularUser.id,
        users.trainerUser.id,
        'TRAINER',
        'false_machine_presence'
      );

      expect(result.status).toBe('pending');
    });
  });

  describe('resolveComplaint', () => {
    it('should resolve complaint and penalize user if needed', async () => {
      const resolved = {
        id: 'complaint-001',
        status: 'penalized',
        pointsDeducted: 50,
      };

      prisma.complaint.update.mockResolvedValue(resolved);

      const result = await gamificationService.resolveComplaint(
        'complaint-001',
        true,
        50
      );

      expect(result.status).toBe('penalized');
      expect(result.pointsDeducted).toBe(50);
    });
  });
});