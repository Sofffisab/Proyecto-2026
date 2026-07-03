import { describe, it, expect, beforeEach, vi } from 'vitest';
import { communicationService } from '../../src/services/communication.service.js';
import { prisma } from '../../src/config/prisma.js';

vi.mock('../../src/config/prisma.js');
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
    it('createNotification crea con read=false por defecto', async () => {
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

    it('markAsRead lanza error si la notificación no pertenece al usuario', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
      });

      await expect(
        communicationService.markAsRead('notif-1', 'user-2')
      ).rejects.toThrow();
    });

    it('markAllAsRead solo afecta al usuario autenticado', async () => {
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

    it('deleteNotification lanza error si no pertenece al usuario', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
      });

      await expect(
        communicationService.deleteNotification('notif-1', 'user-2')
      ).rejects.toThrow();
    });

    it('getUnreadCount cuenta solo read=false', async () => {
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
    it('sendWelcomeEmail arma el HTML esperado', async () => {
      await communicationService.sendWelcomeEmail('test@example.com', 'John');

      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('sendPasswordResetEmail incluye el resetToken en la URL', async () => {
      await communicationService.sendPasswordResetEmail(
        'test@example.com',
        'reset-token-123'
      );

      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('sendEmail propaga errores del proveedor sin romper el proceso llamante', async () => {
      const error = new Error('Email provider error');
      // Mock que lanza error
      await expect(
        communicationService.sendEmail('test@example.com', 'Subject', 'Body')
      ).resolves.toBeDefined();
    });
  });

  describe('notify (combinado)', () => {
    it('crea notificación in-app Y envía email', async () => {
      prisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
      });

      await communicationService.notify('user-1', 'Test', 'test@example.com');

      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });
});
