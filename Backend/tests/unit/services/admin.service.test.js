import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as adminService from '../../../src/services/admin.service.js';
import { prisma } from '../../../src/config/prisma.js';

describe('AdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setMemberActive', () => {
    it('an admin cannot deactivate their own account', async () => {
      await expect(adminService.setMemberActive('a1', 'a1', false)).rejects.toThrow('your own account');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deactivates another account and logs it, keeping the account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@g.com', firstName: 'Una', lastName: 'Per', role: 'USER', isActive: true });
      prisma.user.update.mockResolvedValue({});

      const result = await adminService.setMemberActive('a1', 'u1', false);

      expect(result).toEqual({ id: 'u1', isActive: false });
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isActive: false } });
      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'ACCOUNT_DEACTIVATED', actorId: 'a1' }) })
      );
    });

    it('re-activates a deactivated account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'u@g.com', role: 'USER', isActive: false });
      prisma.user.update.mockResolvedValue({});

      await adminService.setMemberActive('a1', 'u1', true);

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isActive: true } });
    });

    it('404 when the account does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(adminService.setMemberActive('a1', 'ghost', false)).rejects.toThrow('User not found');
    });
  });

  describe('listMembers', () => {
    it('shows the trainer rating only when there are ratings and flags pending invites without leaking the token', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 't1', email: 't@g.com', firstName: 'Tina', lastName: 'R', role: 'TRAINER', isActive: true, createdAt: new Date(), passwordResetToken: null, trainerProfile: { averageRating: 4.66, totalRatings: 9 } },
        { id: 'u1', email: 'new@g.com', firstName: null, lastName: null, role: 'USER', isActive: true, createdAt: new Date(), passwordResetToken: 'hash', trainerProfile: null },
      ]);

      const [trainer, invited] = await adminService.listMembers();

      expect(trainer.rating).toBe(4.7);
      expect(invited).toMatchObject({ name: 'new@g.com', invitePending: true, rating: null });
      expect(invited.passwordResetToken).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('computes machine usage as the share of visits and counts met goals', async () => {
      prisma.gymSession.count.mockResolvedValue(10);
      prisma.machineUsage.findMany.mockResolvedValue([
        { machineId: 'm1', gymSessionId: 's1', userId: 'u1', startedAt: new Date() },
        { machineId: 'm1', gymSessionId: 's2', userId: 'u2', startedAt: new Date() },
        { machineId: 'm1', gymSessionId: 's2', userId: 'u2', startedAt: new Date() }, // same visit twice
        { machineId: 'm2', gymSessionId: 's1', userId: 'u1', startedAt: new Date() },
      ]);
      prisma.machine.findMany.mockResolvedValue([{ id: 'm1', name: 'Cinta' }, { id: 'm2', name: 'Remo' }, { id: 'm3', name: 'Prensa' }]);
      prisma.user.findMany.mockResolvedValue([
        { id: 't1', firstName: 'Tina', lastName: 'R', email: 't@g.com', trainerProfile: { averageRating: 4.5, totalRatings: 4 } },
      ]);
      prisma.assistance.groupBy.mockResolvedValue([{ trainerId: 't1', _count: { _all: 7 } }]);
      prisma.trainerRating.aggregate.mockResolvedValue({ _avg: { rating: 4.25 }, _count: { rating: 8 } });
      prisma.user.count.mockResolvedValueOnce(148).mockResolvedValueOnce(12);
      prisma.goal.findMany.mockResolvedValue([
        { userId: 'u1', currentValue: 10, targetValue: 10 },
        { userId: 'u2', currentValue: 1, targetValue: 10 },
        { userId: 'u2', currentValue: 2, targetValue: 10 },
      ]);

      const stats = await adminService.getStats();

      expect(stats.machineUsage).toEqual([
        { id: 'm1', name: 'Cinta', percent: 20 },
        { id: 'm2', name: 'Remo', percent: 10 },
        { id: 'm3', name: 'Prensa', percent: 0 },
      ]);
      expect(stats.trainers).toEqual([{ id: 't1', name: 'Tina R', rating: 4.5, helps: 7 }]);
      expect(stats.trainersAverage).toBe(4.3);
      expect(stats.users).toEqual({ activated: 148, deactivated: 12, metGoals: 1, notMetGoals: 1 });
    });

    it('has no averages when nobody was rated yet (never invents a number)', async () => {
      prisma.gymSession.count.mockResolvedValue(0);
      prisma.machineUsage.findMany.mockResolvedValue([]);
      prisma.machine.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([]);
      prisma.assistance.groupBy.mockResolvedValue([]);
      prisma.trainerRating.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });
      prisma.user.count.mockResolvedValue(0);
      prisma.goal.findMany.mockResolvedValue([]);

      const stats = await adminService.getStats();

      expect(stats.trainersAverage).toBeNull();
      expect(stats.machineUsage).toEqual([]);
    });
  });

  describe('getHistory', () => {
    it('merges what staff did with what members did, newest first, and paginates', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        { id: 'a1', createdAt: new Date('2026-11-05T10:00:00Z'), action: 'REWARD_STOCK_ADDED', metadata: { prize: 'Toalla', amount: 20 }, actor: { id: 'ad1', firstName: 'Laura', lastName: 'G', role: 'ADMIN' } },
      ]);
      prisma.historialEvento.findMany.mockResolvedValue([
        { id: 'h1', occurredAt: new Date('2026-11-06T10:00:00Z'), tipo: 'GYM_CHECK_IN', metadata: null, user: { id: 'u1', firstName: 'Ana', lastName: 'P', role: 'USER' }, otherUser: null },
        { id: 'h2', occurredAt: new Date('2026-11-04T10:00:00Z'), tipo: 'GYM_CHECK_OUT', metadata: null, user: { id: 'u1', firstName: 'Ana', lastName: 'P', role: 'USER' }, otherUser: null },
      ]);

      const { items, nextCursor } = await adminService.getHistory({ limit: 2 });

      expect(items.map((i) => i.id)).toEqual(['h:h1', 'a:a1']);
      expect(items[1]).toMatchObject({ action: 'REWARD_STOCK_ADDED', params: { amount: 20 }, actor: { role: 'ADMIN' } });
      expect(nextCursor).toBe(new Date('2026-11-05T10:00:00Z').toISOString());
    });

    it('leaves out members who withdrew their analytics consent', async () => {
      prisma.activityLog.findMany.mockResolvedValue([]);
      prisma.historialEvento.findMany.mockResolvedValue([]);

      await adminService.getHistory({ role: 'user' });

      const { where } = prisma.historialEvento.findMany.mock.calls[0][0];
      expect(where.user.NOT).toEqual({ settings: { is: { analyticsConsent: false } } });
      expect(where.user.role).toBe('USER');
    });
  });
});
