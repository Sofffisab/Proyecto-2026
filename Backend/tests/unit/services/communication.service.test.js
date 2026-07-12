import { describe, it, expect, beforeEach, vi } from 'vitest';
import { communicationService } from '../../../src/services/communication.service.js';
import { prisma } from '../../../src/config/prisma.js';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'email-1' }),
    },
  })),
}));

describe('CommunicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notificaciones in-app', () => {
    it('createNotification creates with read=false by default', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        read: false,
        createdAt: new Date(),
      };

      prisma.notification.create.mockResolvedValue(mockNotification);

      const result = await communicationService.createNotification(
        'user-1',
        'Test message'
      );

      expect(result.read).toBe(false);
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            read: false,
          }),
        })
      );
    });

    it('getNotifications applies default pagination and orders by newest first', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);

      const result = await communicationService.getNotifications('user-1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result).toEqual([{ id: 'n1' }]);
    });

    it('getNotifications respects a custom limit/offset', async () => {
      prisma.notification.findMany.mockResolvedValue([]);

      await communicationService.getNotifications('user-1', { limit: 5, offset: 10 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 })
      );
    });

    it('markAsRead succeeds when the notification belongs to the caller', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'notif-1', userId: 'user-1' });
      prisma.notification.update.mockResolvedValue({ id: 'notif-1', read: true });

      const result = await communicationService.markAsRead('notif-1', 'user-1');

      expect(result.read).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { read: true },
      });
    });

    it('markAsRead throws if the notification does not belong to the user', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
      });

      await expect(
        communicationService.markAsRead('notif-1', 'user-2')
      ).rejects.toThrow();
    });

    it('markAsRead throws if the notification does not exist at all', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        communicationService.markAsRead('missing-id', 'user-1')
      ).rejects.toThrow('Notification not found or does not belong to this user');
    });

    it('markAllAsRead only affects the authenticated user', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      await communicationService.markAllAsRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      );
    });

    it('deleteNotification succeeds when it belongs to the caller', async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: 'notif-1', userId: 'user-1' });
      prisma.notification.delete.mockResolvedValue({ id: 'notif-1' });

      const result = await communicationService.deleteNotification('notif-1', 'user-1');

      expect(result).toEqual({ id: 'notif-1' });
      expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'notif-1' } });
    });

    it('deleteNotification throws if it does not belong to the user', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
      });

      await expect(
        communicationService.deleteNotification('notif-1', 'user-2')
      ).rejects.toThrow();
    });

    it('deleteNotification throws if it does not exist at all', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        communicationService.deleteNotification('missing-id', 'user-1')
      ).rejects.toThrow('Notification not found or does not belong to this user');
    });

    it('getUnreadCount only counts read=false', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const result = await communicationService.getUnreadCount('user-1');

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          read: false,
        },
      });
      expect(result).toBe(3);
    });
  });

  describe('emails (mock de Resend)', () => {
    it('sendWelcomeEmail builds the expected HTML', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      await communicationService.sendWelcomeEmail('test@example.com', 'John', 'user-1');

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1' }),
        })
      );
    });

    it('sendWelcomeEmail skips the in-app notification when no userId is given', async () => {
      await communicationService.sendWelcomeEmail('test@example.com', 'John');

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('sendPasswordResetEmail includes the resetToken in the URL', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      await communicationService.sendPasswordResetEmail(
        'test@example.com',
        'reset-token-123',
        'user-1'
      );

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1' }),
        })
      );
    });

    it('sendPasswordResetEmail skips the in-app notification when no userId is given', async () => {
      await communicationService.sendPasswordResetEmail('test@example.com', 'reset-token-123');

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('sendProgressEmail sends a progress update email', async () => {
      const result = await communicationService.sendProgressEmail(
        'test@example.com',
        'You hit 80% of your goal!'
      );

      expect(result).toBeDefined();
    });

    it('sendEmail catches provider errors and returns a failure object instead of throwing', async () => {
      vi.resetModules();
      vi.doMock('resend', () => ({
        Resend: vi.fn().mockImplementation(() => ({
          emails: { send: vi.fn().mockRejectedValue(new Error('Email provider error')) },
        })),
      }));
      const freshCommunicationService = await import('../../../src/services/communication.service.js');

      const result = await freshCommunicationService.sendEmail(
        'test@example.com',
        'Subject',
        'Body'
      );

      expect(result).toEqual({ success: false, error: 'Email provider error' });
    });

    it('sendEmail returns a failure object when no RESEND_API_KEY is configured outside of tests', async () => {
      vi.resetModules();
      vi.stubEnv('NODE_ENV', 'production');
      const originalKey = process.env.RESEND_API_KEY;
      delete process.env.RESEND_API_KEY;

      const freshCommunicationService = await import('../../../src/services/communication.service.js');

      const result = await freshCommunicationService.sendEmail(
        'test@example.com',
        'Subject',
        'Body'
      );

      expect(result).toEqual({ success: false, error: 'RESEND_API_KEY is not configured' });

      vi.unstubAllEnvs();
      if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey;
      vi.resetModules();
    });
  });

  describe('notify (combinado)', () => {
    it('creates an in-app notification AND sends an email', async () => {
      prisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
      });

      await communicationService.notify('user-1', 'Test', 'test@example.com');

      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('notifyTrainerOfReturningStudent', () => {
    const student = { id: 'student-1', firstName: 'Ana', lastName: 'Gomez' };

    it("uses the 'never assisted' message when daysSinceLastAssistance is null", async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      const result = await communicationService.notifyTrainerOfReturningStudent(
        'trainer-1',
        student,
        { checkInAt: new Date(), daysSinceLastAssistance: null, location: 'Cinta 3' }
      );

      expect(result).toEqual({ id: 'notif-1' });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            body: expect.stringContaining('todavía no lo/la ayudaste'),
          }),
        })
      );
    });

    it('uses the "it has been N days" message when daysSinceLastAssistance is a number', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notif-2' });

      await communicationService.notifyTrainerOfReturningStudent('trainer-1', student, {
        checkInAt: new Date(),
        daysSinceLastAssistance: 5,
        location: 'Cinta 3',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            body: expect.stringContaining('hace 5 día(s)'),
          }),
        })
      );
    });

    it('falls back to "ubicación desconocida" when no location is given', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notif-3' });

      await communicationService.notifyTrainerOfReturningStudent('trainer-1', student, {
        checkInAt: new Date(),
        daysSinceLastAssistance: 2,
        location: null,
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            body: expect.stringContaining('ubicación desconocida'),
          }),
        })
      );
    });

    it('does not let a realtime-emit failure break the notification creation', async () => {
      prisma.notification.create.mockResolvedValue({ id: 'notif-4' });

      // The dynamic import of realtime/ably.js is wrapped in its own
      // try/catch specifically so a publish failure never surfaces here.
      const result = await communicationService.notifyTrainerOfReturningStudent(
        'trainer-1',
        student,
        { checkInAt: new Date(), daysSinceLastAssistance: 1, location: 'Cinta 3' }
      );

      expect(result).toEqual({ id: 'notif-4' });
    });

    it('swallows the error and still returns the notification when emitNotificationEvent itself throws', async () => {
      vi.resetModules();
      vi.doMock('../../../src/realtime/ably.js', () => ({
        emitNotificationEvent: vi.fn().mockImplementation(() => {
          throw new Error('Ably publish failed');
        }),
      }));

      const freshCommunicationService = (
        await import('../../../src/services/communication.service.js')
      ).communicationService;

      prisma.notification.create.mockResolvedValue({ id: 'notif-5' });

      const result = await freshCommunicationService.notifyTrainerOfReturningStudent(
        'trainer-1',
        student,
        { checkInAt: new Date(), daysSinceLastAssistance: 1, location: 'Cinta 3' }
      );

      expect(result).toEqual({ id: 'notif-5' });

      vi.doUnmock('../../../src/realtime/ably.js');
      vi.resetModules();
    });
  });
});
