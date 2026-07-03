import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assistanceService } from '../../../src/services/assistance.service.js';
import { prisma } from '../../../src/config/prisma.js';


describe('AssistanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('request', () => {
    it('crea solicitud en estado PENDING', async () => {
      const mockAssistance = {
        id: 'assist-1',
        userId: 'user-1',
        trainerId: null,
        status: 'PENDING',
        createdAt: new Date(),
      };

      prisma.assistance.create.mockResolvedValue(mockAssistance);

      const result = await assistanceService.request('user-1', 'user-gym-1');

      expect(prisma.assistance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: 'PENDING',
        }),
      });
      expect(result.status).toBe('PENDING');
    });
  });

  describe('assign', () => {
    it('assign solo permitido para TRAINER/ADMIN', async () => {
      const normalUser = { id: 'user-1', role: 'USER' };

      // Mock usuario sin permisos
      const result = await assistanceService.canAssign(normalUser);
      expect(result).toBe(false);
    });

    it('permite asignación por TRAINER', async () => {
      const trainer = { id: 'trainer-1', role: 'TRAINER' };
      const result = await assistanceService.canAssign(trainer);
      expect(result).toBe(true);
    });
  });

  describe('complete', () => {
    it('complete cambia estado y setea completedAt', async () => {
      const mockUpdated = {
        id: 'assist-1',
        status: 'COMPLETED',
        completedAt: new Date(),
      };

      prisma.assistance.update.mockResolvedValue(mockUpdated);

      const result = await assistanceService.complete('assist-1');

      expect(prisma.assistance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'assist-1' },
        })
      );
      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('cancel rechaza si ya está completed', async () => {
      const mockAssistance = {
        id: 'assist-1',
        status: 'COMPLETED',
      };

      prisma.assistance.findUnique.mockResolvedValue(mockAssistance);

      await expect(
        assistanceService.cancel('assist-1')
      ).rejects.toThrow('Cannot cancel completed assistance');
    });
  });
});
