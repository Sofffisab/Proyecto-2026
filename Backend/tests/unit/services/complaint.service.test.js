import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as complaintService from '../../../src/services/complaint.service.js';
import { prisma } from '../../../src/config/prisma.js';

describe('ComplaintService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a complaint in PENDING status', async () => {
    const mockComplaint = {
      id: 'complaint-1',
      reporterId: 'user-1',
      reportedUserId: 'user-2',
      status: 'PENDING',
      createdAt: new Date(),
    };

    prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
    prisma.complaint.create.mockResolvedValue(mockComplaint);

    const result = await complaintService.createComplaint({
      reporterId: 'user-1',
      reportedUserId: 'user-2',
      reason: 'Test',
    });

    expect(result.status).toBe('PENDING');
  });

  it('approveComplaint setea reviewedAt y resolution', async () => {
    const mockResolved = {
      id: 'complaint-1',
      status: 'APPROVED',
      reportedUserId: 'user-2',
      reviewedAt: new Date(),
    };

    prisma.complaint.update.mockResolvedValue(mockResolved);
    // 3rd approved complaint against this user -> past the 2 free strikes,
    // so a penalty should be applied.
    prisma.complaint.count.mockResolvedValue(3);
    prisma.pointReviewRequest.findFirst.mockResolvedValue(null);
    prisma.pointTransaction.create.mockResolvedValue({});
    prisma.notification.create.mockResolvedValue({});

    const result = await complaintService.approveComplaint('complaint-1', 'admin-1');

    expect(result.status).toBe('APPROVED');
    expect(result.reviewedAt).toBeDefined();
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: -25 }) })
    );
  });

  it('approveComplaint: first two approved complaints are free (no penalty)', async () => {
    const mockResolved = {
      id: 'complaint-1',
      status: 'APPROVED',
      reportedUserId: 'user-2',
      reviewedAt: new Date(),
    };

    prisma.complaint.update.mockResolvedValue(mockResolved);
    prisma.complaint.count.mockResolvedValue(1);
    prisma.notification.create.mockResolvedValue({});

    await complaintService.approveComplaint('complaint-1', 'admin-1');

    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Complaint reviewed' }),
      })
    );
  });

  it('approveComplaint: raises an admin review alert past the alert threshold', async () => {
    const mockResolved = {
      id: 'complaint-1',
      status: 'APPROVED',
      reportedUserId: 'user-2',
      reviewedAt: new Date(),
    };

    prisma.complaint.update.mockResolvedValue(mockResolved);
    prisma.complaint.count.mockResolvedValue(5); // ALERT_THRESHOLD
    prisma.pointReviewRequest.findFirst.mockResolvedValue(null);
    prisma.pointTransaction.create.mockResolvedValue({});
    prisma.notification.create.mockResolvedValue({});

    await complaintService.approveComplaint('complaint-1', 'admin-1');

    expect(prisma.pointReviewRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-2', resolved: false }),
      })
    );
  });

  it('rejectComplaint setea reviewedAt sin resolution positiva', async () => {
    const mockRejected = {
      id: 'complaint-1',
      status: 'REJECTED',
      reviewedAt: new Date(),
    };

    prisma.complaint.update.mockResolvedValue(mockRejected);

    const result = await complaintService.rejectComplaint('complaint-1', 'admin-1');

    expect(result.status).toBe('REJECTED');
  });

  it('getUserComplaints filters only by the authenticated user', async () => {
    const mockComplaints = [{ id: 'complaint-1', reporterId: 'user-1' }];
    prisma.complaint.findMany.mockResolvedValue(mockComplaints);

    const result = await complaintService.getUserComplaints('user-1');

    expect(prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reporterId: 'user-1' } })
    );
    expect(result).toEqual(mockComplaints);
  });

  it('getComplaints returns all of them (no user filter)', async () => {
    const mockComplaints = [{ id: 'complaint-1' }, { id: 'complaint-2' }];
    prisma.complaint.findMany.mockResolvedValue(mockComplaints);

    const result = await complaintService.getComplaints();

    expect(result).toEqual(mockComplaints);
  });

  describe('createAutoNoHelpComplaint', () => {
    it('creates an AUTO_NO_HELP complaint linked to the gym session', async () => {
      prisma.complaint.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: 'trainer-1', role: 'TRAINER' });
      prisma.complaint.create.mockResolvedValue({
        id: 'complaint-1',
        reporterId: 'user-1',
        reportedUserId: 'trainer-1',
        gymSessionId: 'session-1',
        source: 'AUTO_NO_HELP',
        status: 'PENDING',
      });

      const result = await complaintService.createAutoNoHelpComplaint({
        reporterId: 'user-1',
        reportedUserId: 'trainer-1',
        gymSessionId: 'session-1',
        comment: 'No me ayudó en nada',
      });

      expect(prisma.complaint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reporterId: 'user-1',
          reportedUserId: 'trainer-1',
          gymSessionId: 'session-1',
          source: 'AUTO_NO_HELP',
          status: 'PENDING',
          message: 'No me ayudó en nada',
        }),
      });
      expect(result.source).toBe('AUTO_NO_HELP');
    });

    it('is idempotent: returns the existing complaint instead of duplicating it', async () => {
      const existing = { id: 'complaint-1', source: 'AUTO_NO_HELP' };
      prisma.complaint.findFirst.mockResolvedValue(existing);

      const result = await complaintService.createAutoNoHelpComplaint({
        reporterId: 'user-1',
        reportedUserId: 'trainer-1',
        gymSessionId: 'session-1',
      });

      expect(result).toBe(existing);
      expect(prisma.complaint.create).not.toHaveBeenCalled();
    });

    it('rejects reporting yourself', async () => {
      await expect(
        complaintService.createAutoNoHelpComplaint({
          reporterId: 'user-1',
          reportedUserId: 'user-1',
          gymSessionId: 'session-1',
        })
      ).rejects.toThrow('Cannot report yourself');
    });
  });

  describe('createTrainerComplaint', () => {
    it('lets a trainer report a member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', role: 'USER' });
      prisma.complaint.create.mockResolvedValue({
        id: 'complaint-2',
        reporterId: 'trainer-1',
        reportedUserId: 'user-2',
        source: 'TRAINER_REPORT',
        status: 'PENDING',
      });

      const result = await complaintService.createTrainerComplaint({
        reporterId: 'trainer-1',
        reportedUserId: 'user-2',
        reason: 'DAÑO_DE_MAQUINA',
        message: 'Rompió la cinta',
      });

      expect(prisma.complaint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reporterId: 'trainer-1',
          reportedUserId: 'user-2',
          reason: 'DAÑO_DE_MAQUINA',
          message: 'Rompió la cinta',
          source: 'TRAINER_REPORT',
          status: 'PENDING',
        }),
      });
      expect(result.source).toBe('TRAINER_REPORT');
    });

    it('rejects reporting a non-member (e.g. another trainer)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'trainer-2', role: 'TRAINER' });

      await expect(
        complaintService.createTrainerComplaint({
          reporterId: 'trainer-1',
          reportedUserId: 'trainer-2',
          reason: 'MAL_COMPORTAMIENTO',
        })
      ).rejects.toThrow('Trainers can only report regular members through this endpoint');
      expect(prisma.complaint.create).not.toHaveBeenCalled();
    });

    it('rejects reporting yourself', async () => {
      await expect(
        complaintService.createTrainerComplaint({
          reporterId: 'trainer-1',
          reportedUserId: 'trainer-1',
          reason: 'OTRO',
        })
      ).rejects.toThrow('Cannot report yourself');
    });
  });
});
