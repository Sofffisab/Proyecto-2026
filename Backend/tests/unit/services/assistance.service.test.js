import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as assistanceService from '../../../src/services/assistance.service.js';
import { prisma } from '../../../src/config/prisma.js';
import * as pushNotificationService from '../../../src/services/pushNotification.service.js';

vi.mock('../../../src/services/pushNotification.service.js');

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

    it('awards the student ASSISTANCE_COMPLETED points (non-blocking)', async () => {
      const mockAssigned = {
        id: 'assist-2',
        status: 'ASSIGNED',
        trainerId: 'trainer-1',
        userId: 'student-1',
      };
      const mockUpdated = {
        id: 'assist-2',
        status: 'COMPLETED',
        trainerId: 'trainer-1',
        userId: 'student-1',
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
      prisma.pointTransaction.create.mockResolvedValue({});

      await assistanceService.completeAssistance('assist-2', 'trainer-1', 'TRAINER');
      // addPoints is fired non-blocking (.catch), flush microtasks before asserting.
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'student-1', points: 15 }),
        })
      );
    });

    it('rejects when the request is not found', async () => {
      prisma.assistance.findUnique.mockResolvedValue(null);

      await expect(
        assistanceService.completeAssistance('missing', 'trainer-1', 'TRAINER')
      ).rejects.toThrow('Assistance request not found');
    });

    it('rejects when the request is not ASSIGNED', async () => {
      prisma.assistance.findUnique.mockResolvedValue({ id: 'a1', status: 'PENDING' });

      await expect(
        assistanceService.completeAssistance('a1', 'trainer-1', 'TRAINER')
      ).rejects.toThrow('Cannot complete a request with status: PENDING');
    });

    it('rejects when a TRAINER tries to complete an assistance not assigned to them', async () => {
      prisma.assistance.findUnique.mockResolvedValue({
        id: 'a1',
        status: 'ASSIGNED',
        trainerId: 'trainer-1',
      });

      await expect(
        assistanceService.completeAssistance('a1', 'trainer-2', 'TRAINER')
      ).rejects.toThrow('Forbidden: this assistance is not assigned to you');
    });

    it('allows an ADMIN to complete an assistance not assigned to them', async () => {
      prisma.assistance.findUnique.mockResolvedValue({
        id: 'a1',
        status: 'ASSIGNED',
        trainerId: 'trainer-1',
        userId: 'student-1',
      });
      prisma.assistance.update.mockResolvedValue({
        id: 'a1',
        status: 'COMPLETED',
        trainerId: 'trainer-1',
        userId: 'student-1',
      });
      prisma.assistance.count.mockResolvedValue(1);
      prisma.trainerRating.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: { rating: 1 } });
      prisma.trainerProfile.upsert.mockResolvedValue({});

      const result = await assistanceService.completeAssistance('a1', 'admin-1', 'ADMIN');

      expect(result.status).toBe('COMPLETED');
    });

    it('does not attempt trainer metric/availability updates when the assistance has no trainerId', async () => {
      prisma.assistance.findUnique.mockResolvedValue({ id: 'a1', status: 'ASSIGNED', trainerId: null, userId: 'student-1' });
      prisma.assistance.update.mockResolvedValue({ id: 'a1', status: 'COMPLETED', trainerId: null, userId: 'student-1' });

      await assistanceService.completeAssistance('a1', 'admin-1', 'ADMIN');

      expect(prisma.trainerProfile.upsert).not.toHaveBeenCalled();
    });
  });

  describe('assignAssistance', () => {
    it('throws when the trainer does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(assistanceService.assignAssistance('a1', 'trainer-1')).rejects.toThrow(
        'Trainer not found'
      );
    });

    it('throws when the target user is not a trainer', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'USER', isActive: true });

      await expect(assistanceService.assignAssistance('a1', 'u1')).rejects.toThrow(
        'User is not a trainer'
      );
    });

    it('throws when the trainer account is disabled', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 't1', role: 'TRAINER', isActive: false });

      await expect(assistanceService.assignAssistance('a1', 't1')).rejects.toThrow(
        'Trainer account is disabled'
      );
    });

    it('throws when the trainer is currently BUSY', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 't1',
        role: 'TRAINER',
        isActive: true,
        trainerProfile: { availability: 'BUSY' },
      });

      await expect(assistanceService.assignAssistance('a1', 't1')).rejects.toThrow(
        'Trainer is currently busy and cannot be assigned new assistance'
      );
    });

    it('throws when the assistance request does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 't1',
        role: 'TRAINER',
        isActive: true,
        trainerProfile: null,
      });
      prisma.assistance.findUnique.mockResolvedValue(null);

      await expect(assistanceService.assignAssistance('missing', 't1')).rejects.toThrow(
        'Assistance request not found'
      );
    });

    it('throws when the assistance request is not PENDING', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 't1',
        role: 'TRAINER',
        isActive: true,
        trainerProfile: null,
      });
      prisma.assistance.findUnique.mockResolvedValue({ id: 'a1', status: 'COMPLETED' });

      await expect(assistanceService.assignAssistance('a1', 't1')).rejects.toThrow(
        'Cannot assign a request with status: COMPLETED'
      );
    });

    it('assigns the assistance and marks the trainer BUSY when everything is valid', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 't1',
        role: 'TRAINER',
        isActive: true,
        trainerProfile: null,
      });
      prisma.assistance.findUnique.mockResolvedValue({ id: 'a1', status: 'PENDING' });
      prisma.assistance.update.mockResolvedValue({ id: 'a1', status: 'ASSIGNED', trainerId: 't1' });
      prisma.trainerProfile.upsert.mockResolvedValue({});

      const result = await assistanceService.assignAssistance('a1', 't1');

      expect(prisma.assistance.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { status: 'ASSIGNED', trainerId: 't1', assignedAt: expect.any(Date) },
      });
      expect(prisma.trainerProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 't1' },
          update: expect.objectContaining({ availability: 'BUSY' }),
        })
      );
      expect(result.status).toBe('ASSIGNED');
    });
  });

  describe('setTrainerAvailability', () => {
    it('throws on an invalid availability value', async () => {
      await expect(
        assistanceService.setTrainerAvailability('t1', 'ON_VACATION')
      ).rejects.toThrow('Invalid availability value');
    });

    it('upserts AVAILABLE', async () => {
      prisma.trainerProfile.upsert.mockResolvedValue({ availability: 'AVAILABLE' });

      const result = await assistanceService.setTrainerAvailability('t1', 'AVAILABLE');

      expect(prisma.trainerProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 't1' },
        update: { availability: 'AVAILABLE', availabilityUpdatedAt: expect.any(Date) },
        create: { userId: 't1', availability: 'AVAILABLE', specialties: ['GENERAL'] },
      });
      expect(result.availability).toBe('AVAILABLE');
    });
  });

  describe('getTrainerAvailability', () => {
    it('returns the stored availability when a profile exists', async () => {
      prisma.trainerProfile.findUnique.mockResolvedValue({ availability: 'BUSY' });

      const result = await assistanceService.getTrainerAvailability('t1');

      expect(result).toBe('BUSY');
    });

    it('defaults to AVAILABLE when no profile exists', async () => {
      prisma.trainerProfile.findUnique.mockResolvedValue(null);

      const result = await assistanceService.getTrainerAvailability('t1');

      expect(result).toBe('AVAILABLE');
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

    it('throws when the assistance request does not belong to the caller / does not exist', async () => {
      prisma.assistance.findFirst.mockResolvedValue(null);

      await expect(
        assistanceService.cancelAssistance('missing', 'user-1')
      ).rejects.toThrow('Assistance request not found');
    });

    it('cancels a PENDING request without touching trainer availability', async () => {
      prisma.assistance.findFirst.mockResolvedValue({ id: 'a1', userId: 'user-1', status: 'PENDING', trainerId: null });
      prisma.assistance.update.mockResolvedValue({ id: 'a1', status: 'CANCELLED' });

      const result = await assistanceService.cancelAssistance('a1', 'user-1');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.trainerProfile.upsert).not.toHaveBeenCalled();
    });

    it('frees the trainer when cancelling an ASSIGNED request', async () => {
      prisma.assistance.findFirst.mockResolvedValue({
        id: 'a1',
        userId: 'user-1',
        status: 'ASSIGNED',
        trainerId: 't1',
      });
      prisma.assistance.update.mockResolvedValue({ id: 'a1', status: 'CANCELLED' });
      prisma.trainerProfile.upsert.mockResolvedValue({});

      await assistanceService.cancelAssistance('a1', 'user-1');

      expect(prisma.trainerProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 't1' },
          update: expect.objectContaining({ availability: 'AVAILABLE' }),
        })
      );
    });
  });

  describe('getPendingAssistance', () => {
    it('returns pending requests ordered by requestedAt ascending', async () => {
      const mockList = [{ id: 'a1' }, { id: 'a2' }];
      prisma.assistance.findMany.mockResolvedValue(mockList);

      const result = await assistanceService.getPendingAssistance();

      expect(prisma.assistance.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { requestedAt: 'asc' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('getAssistanceHistory', () => {
    it('returns the history for a given user ordered by requestedAt descending', async () => {
      const mockList = [{ id: 'a1' }, { id: 'a2' }];
      prisma.assistance.findMany.mockResolvedValue(mockList);

      const result = await assistanceService.getAssistanceHistory('user-1');

      expect(prisma.assistance.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { requestedAt: 'desc' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('requestAssistance (trainer notification side-effects)', () => {
    it('does not throw and does not send a push when there are no available trainers', async () => {
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Ana', lastName: 'Gomez' });
      prisma.assistance.create.mockResolvedValue({
        id: 'a1',
        userId: 'user-1',
        status: 'PENDING',
        requestedAt: new Date(),
      });
      prisma.user.findMany.mockResolvedValue([]);

      await assistanceService.requestAssistance('user-1');
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'TRAINER', isActive: true }),
        })
      );
    });

    it('sends a push alert to every available trainer when at least one exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Ana', lastName: 'Gomez' });
      const requestedAt = new Date();
      prisma.assistance.create.mockResolvedValue({
        id: 'a1',
        userId: 'user-1',
        status: 'PENDING',
        requestedAt,
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'trainer-1' }, { id: 'trainer-2' }]);
      pushNotificationService.sendTrainerAlert.mockResolvedValue(undefined);

      await assistanceService.requestAssistance('user-1');
      await new Promise((resolve) => setImmediate(resolve));

      expect(pushNotificationService.sendTrainerAlert).toHaveBeenCalledWith({
        trainerIds: ['trainer-1', 'trainer-2'],
        type: 'SOS_ENTRENADOR',
        payload: {
          assistanceId: 'a1',
          userId: 'user-1',
          userName: 'Ana Gomez',
          requestedAt: requestedAt.toISOString(),
        },
      });
    });

    it("falls back to 'Un socio' as the userName when the requester can't be found", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const requestedAt = new Date();
      prisma.assistance.create.mockResolvedValue({
        id: 'a1',
        userId: 'user-1',
        status: 'PENDING',
        requestedAt,
      });
      prisma.user.findMany.mockResolvedValue([{ id: 'trainer-1' }]);
      pushNotificationService.sendTrainerAlert.mockResolvedValue(undefined);

      await assistanceService.requestAssistance('user-1');
      await new Promise((resolve) => setImmediate(resolve));

      expect(pushNotificationService.sendTrainerAlert).toHaveBeenCalledWith(
        expect.objectContaining({ payload: expect.objectContaining({ userName: 'Un socio' }) })
      );
    });

    it('does not let a push failure break the assistance request', async () => {
      prisma.user.findUnique.mockResolvedValue({ firstName: 'Ana', lastName: 'Gomez' });
      const mockAssistance = {
        id: 'a1',
        userId: 'user-1',
        status: 'PENDING',
        requestedAt: new Date(),
      };
      prisma.assistance.create.mockResolvedValue(mockAssistance);
      prisma.user.findMany.mockRejectedValue(new Error('db exploded'));

      const result = await assistanceService.requestAssistance('user-1');
      await new Promise((resolve) => setImmediate(resolve));

      expect(result).toEqual(mockAssistance);
    });
  });
});
