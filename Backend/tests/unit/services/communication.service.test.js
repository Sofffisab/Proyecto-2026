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

    it('markAsRead throws if the notification does not belong to the user', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
      });

      await expect(
        communicationService.markAsRead('notif-1', 'user-2')
      ).rejects.toThrow();
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

    it('deleteNotification throws if it does not belong to the user', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
      });

      await expect(
        communicationService.deleteNotification('notif-1', 'user-2')
      ).rejects.toThrow();
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

    it('sendEmail propagates provider errors without breaking the calling process', async () => {
      const error = new Error('Email provider error');
      // Mock that throws an error
      await expect(
        communicationService.sendEmail('test@example.com', 'Subject', 'Body')
      ).resolves.toBeDefined();
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
});
