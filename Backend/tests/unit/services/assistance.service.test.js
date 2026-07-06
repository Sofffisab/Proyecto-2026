import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as assistanceService from '../../../src/services/assistance.service.js';
import { prisma } from '../../../src/config/prisma.js';

describe('AssistanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestAssistance', () => {
    it('creates a request in PENDING status', async () => {
      const mockAssistance = {
        id: 'assist-1',
        userId: 'user-1',
        trainerId: null,
        status: 'PENDING',
        createdAt: new Date(),
      };

      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.assistance.create.mockResolvedValue(mockAssistance);

      const result = await assistanceService.requestAssistance('user-1');

      expect(prisma.assistance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: 'PENDING',
        }),
      });
      expect(result.status).toBe('PENDING');
    });
  });

  describe('canAssign', () => {
    it('assign only allowed for TRAINER/ADMIN', () => {
      const normalUser = { id: 'user-1', role: 'USER' };
      expect(assistanceService.canAssign(normalUser)).toBe(false);
    });

    it('allows assignment by TRAINER', () => {
      const trainer = { id: 'trainer-1', role: 'TRAINER' };
      expect(assistanceService.canAssign(trainer)).toBe(true);
    });
  });

  describe('completeAssistance', () => {
    it('complete changes the status and sets completedAt', async () => {
      const mockAssigned = {
        id: 'assist-1',
        status: 'ASSIGNED',
        trainerId: 'trainer-1',
      };
      const mockUpdated = {
        id: 'assist-1',
        status: 'COMPLETED',
        trainerId: 'trainer-1',
        completedAt: new Date(),
      };

      prisma.assistance.findUnique.mockResolvedValue(mockAssigned);
      prisma.assistance.update.mockResolvedValue(mockUpdated);
      prisma.assistance.count.mockResolvedValue(1);
      prisma.trainerRating.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: { rating: 2 },
      });
      prisma.trainerProfile.upsert.mockResolvedValue({});

      const result = await assistanceService.completeAssistance('assist-1', 'trainer-1', 'TRAINER');

      expect(prisma.assistance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'assist-1' },
        })
      );
      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('cancelAssistance', () => {
    it('cancel rejects if already completed', async () => {
      const mockAssistance = {
        id: 'assist-1',
        userId: 'user-1',
        status: 'COMPLETED',
      };

      prisma.assistance.findFirst.mockResolvedValue(mockAssistance);

      await expect(
        assistanceService.cancelAssistance('assist-1', 'user-1')
      ).rejects.toThrow('Cannot cancel a request with status: COMPLETED');
    });
  });
});
