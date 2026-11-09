import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as reportService from '../../../src/services/report.service.js';
import { prisma } from '../../../src/config/prisma.js';

const complaintRow = (over = {}) => ({
  id: 'c1',
  status: 'PENDING',
  source: 'USER',
  reason: 'Rompió una máquina',
  message: null,
  createdAt: new Date('2026-11-01'),
  reviewedAt: null,
  penaltyPoints: null,
  reporter: { id: 'u1', firstName: 'Ana', lastName: 'Paz', role: 'USER' },
  reported: { id: 'u2', firstName: 'Beto', lastName: 'Gil', role: 'USER' },
  ...over,
});

describe('ReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.pointTransaction.create.mockResolvedValue({});
    prisma.notification.create.mockResolvedValue({});
  });

  describe('acceptReport', () => {
    it('takes points following the progressive penalty and stores how many', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow());
      prisma.complaint.update.mockResolvedValue({});
      prisma.complaint.count.mockResolvedValue(3); // 3rd accepted -> past the 2 free strikes
      prisma.denuncia.count.mockResolvedValue(0);

      const result = await reportService.acceptReport('COMPLAINT', 'c1', 'admin-1');

      expect(result).toMatchObject({ state: 'ACCEPTED', penalty: 25 });
      expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u2', points: -25 }) })
      );
      expect(prisma.complaint.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { penaltyPoints: 25 } });
    });

    it('does not take points while the person still has free strikes', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow());
      prisma.complaint.update.mockResolvedValue({});
      prisma.complaint.count.mockResolvedValue(1);
      prisma.denuncia.count.mockResolvedValue(0);

      const result = await reportService.acceptReport('COMPLAINT', 'c1', 'admin-1');

      expect(result.penalty).toBe(0);
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    });

    it('counts accepted denuncias as strikes too', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow());
      prisma.complaint.update.mockResolvedValue({});
      prisma.complaint.count.mockResolvedValue(1);
      prisma.denuncia.count.mockResolvedValue(2); // 1 + 2 = 3rd strike

      const result = await reportService.acceptReport('COMPLAINT', 'c1', 'admin-1');

      expect(result.penalty).toBe(25);
    });

    it('refuses to review a report twice', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow({ status: 'APPROVED' }));

      await expect(reportService.acceptReport('COMPLAINT', 'c1', 'admin-1')).rejects.toThrow('already reviewed');
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    });

    it('accepting a broken-machine denuncia takes no points from anybody', async () => {
      prisma.denuncia.findUnique.mockResolvedValue({
        id: 'd1',
        status: 'PENDING',
        type: 'MACHINE_BROKEN',
        createdAt: new Date(),
        reporter: { id: 't1', firstName: 'Tina', lastName: 'Ruiz', role: 'TRAINER' },
        reported: null,
        machine: { id: 'm1', name: 'Cinta 3' },
      });
      prisma.denuncia.update.mockResolvedValue({});

      const result = await reportService.acceptReport('DENUNCIA', 'd1', 'admin-1');

      expect(result.penalty).toBe(0);
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
      expect(prisma.denuncia.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REVIEWED' }) })
      );
    });

    it('rejects an unknown kind', async () => {
      await expect(reportService.acceptReport('NOPE', 'x', 'admin-1')).rejects.toThrow('Unknown report kind');
    });
  });

  describe('rejectReport / escalateReport', () => {
    it('rejecting never touches points', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow());
      prisma.complaint.update.mockResolvedValue({});

      const result = await reportService.rejectReport('COMPLAINT', 'c1', 'admin-1');

      expect(result.state).toBe('REJECTED');
      expect(prisma.complaint.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED', reviewedBy: 'admin-1' }) })
      );
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    });

    it('escalating marks it ESCALATED without points or a notification to the person', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow());
      prisma.complaint.update.mockResolvedValue({});

      const result = await reportService.escalateReport('COMPLAINT', 'c1', 'admin-1');

      expect(result.state).toBe('ESCALATED');
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('only pending reports can be escalated', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow({ status: 'REJECTED' }));
      await expect(reportService.escalateReport('COMPLAINT', 'c1', 'admin-1')).rejects.toThrow('Only pending');
    });

    it('an escalated report can still be accepted afterwards', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow({ status: 'ESCALATED' }));
      prisma.complaint.update.mockResolvedValue({});
      prisma.complaint.count.mockResolvedValue(1);
      prisma.denuncia.count.mockResolvedValue(0);

      await expect(reportService.acceptReport('COMPLAINT', 'c1', 'admin-1')).resolves.toMatchObject({ state: 'ACCEPTED' });
    });
  });

  describe('revertReport', () => {
    it('gives back exactly the points that were taken', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow({ status: 'APPROVED', penaltyPoints: 50 }));
      prisma.complaint.update.mockResolvedValue({});

      const result = await reportService.revertReport('COMPLAINT', 'c1', 'admin-1');

      expect(result).toMatchObject({ state: 'REJECTED', refunded: 50 });
      expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u2', points: 50 }) })
      );
    });

    it('only accepted reports can be removed', async () => {
      prisma.complaint.findUnique.mockResolvedValue(complaintRow());
      await expect(reportService.revertReport('COMPLAINT', 'c1', 'admin-1')).rejects.toThrow('Only accepted');
    });
  });

  describe('listReports', () => {
    it('shows how many earlier reports the reported person has', async () => {
      prisma.complaint.findMany
        .mockResolvedValueOnce([complaintRow()]) // the list
        .mockResolvedValueOnce([
          { id: 'c1', reportedUserId: 'u2', status: 'PENDING', reason: 'x', createdAt: new Date('2026-11-01') },
          { id: 'c0', reportedUserId: 'u2', status: 'APPROVED', reason: 'y', createdAt: new Date('2026-10-01') },
          { id: 'c-1', reportedUserId: 'u2', status: 'REJECTED', reason: 'z', createdAt: new Date('2026-09-01') },
        ]);
      prisma.denuncia.findMany.mockResolvedValue([]);
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 120 } });
      prisma.complaint.count.mockResolvedValue(2);
      prisma.denuncia.count.mockResolvedValue(0);

      const [item] = await reportService.listReports({ state: 'PENDING' });

      expect(item.previousReports).toMatchObject({ total: 2, accepted: 1, rejected: 1 });
      expect(item.points).toBe(120);
      // Two strikes already: accepting this one is the first that costs points.
      expect(item.nextPenalty).toBe(25);
      expect(item.reported.name).toBe('Beto Gil');
    });

    it('rejects an unknown state', async () => {
      await expect(reportService.listReports({ state: 'WHATEVER' })).rejects.toThrow('Unknown report state');
    });
  });

  describe('getSuspiciousBehavior', () => {
    it('flags people over the thresholds and ignores automatic complaints as "made"', async () => {
      const received = Array.from({ length: 3 }, (_, i) => ({ reporterId: `r${i}`, reportedUserId: 'u2', source: 'USER' }));
      const made = Array.from({ length: 5 }, () => ({ reporterId: 'u9', reportedUserId: 'x', source: 'USER' }));
      const auto = Array.from({ length: 6 }, () => ({ reporterId: 'u8', reportedUserId: 'y', source: 'AUTO_NO_HELP' }));
      prisma.complaint.findMany.mockResolvedValue([...received, ...made, ...auto]);
      prisma.denuncia.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'u2', firstName: 'Beto', lastName: 'Gil' },
        { id: 'u9', firstName: 'Cora', lastName: 'Sol' },
      ]);

      const result = await reportService.getSuspiciousBehavior();

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'u2', kind: 'received', count: 3, name: 'Beto Gil' }),
          expect.objectContaining({ userId: 'u9', kind: 'made', count: 5, name: 'Cora Sol' }),
        ])
      );
      expect(result.find((r) => r.userId === 'u8' && r.kind === 'made')).toBeUndefined();
    });
  });
});
