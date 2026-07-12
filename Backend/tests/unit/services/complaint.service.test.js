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

  it('createComplaint rejects reporting yourself', async () => {
    await expect(
      complaintService.createComplaint({
        reporterId: 'user-1',
        reportedUserId: 'user-1',
        reason: 'Test',
      })
    ).rejects.toThrow('Cannot report yourself');
  });

  it('createComplaint throws if the reported user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      complaintService.createComplaint({
        reporterId: 'user-1',
        reportedUserId: 'ghost',
        reason: 'Test',
      })
    ).rejects.toThrow('Reported user not found');
  });

  it('getComplaintById returns the complaint by id', async () => {
    prisma.complaint.findUnique.mockResolvedValue({ id: 'complaint-1' });

    const result = await complaintService.getComplaintById('complaint-1');

    expect(result.id).toBe('complaint-1');
    expect(prisma.complaint.findUnique).toHaveBeenCalledWith({ where: { id: 'complaint-1' } });
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

  it('approveComplaint: does not duplicate the admin alert if one is already open', async () => {
    prisma.complaint.update.mockResolvedValue({
      id: 'complaint-1',
      status: 'APPROVED',
      reportedUserId: 'user-2',
    });
    prisma.complaint.count.mockResolvedValue(5);
    prisma.pointReviewRequest.findFirst.mockResolvedValue({ id: 'existing-flag' });
    prisma.pointTransaction.create.mockResolvedValue({});
    prisma.notification.create.mockResolvedValue({});

    await complaintService.approveComplaint('complaint-1', 'admin-1');

    expect(prisma.pointReviewRequest.create).not.toHaveBeenCalled();
  });

  it('approveComplaint: logs but does not throw if raising the admin alert fails', async () => {
    prisma.complaint.update.mockResolvedValue({
      id: 'complaint-1',
      status: 'APPROVED',
      reportedUserId: 'user-2',
    });
    prisma.complaint.count.mockResolvedValue(5);
    prisma.pointReviewRequest.findFirst.mockResolvedValue(null);
    prisma.pointReviewRequest.create.mockRejectedValue(new Error('db down'));
    prisma.pointTransaction.create.mockResolvedValue({});
    prisma.notification.create.mockResolvedValue({});

    await expect(
      complaintService.approveComplaint('complaint-1', 'admin-1')
    ).resolves.toBeDefined();
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

    it('falls back to a null gymSessionId and null message when neither is provided', async () => {
      prisma.complaint.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: 'trainer-1', role: 'TRAINER' });
      prisma.complaint.create.mockResolvedValue({ id: 'complaint-1', source: 'AUTO_NO_HELP' });

      await complaintService.createAutoNoHelpComplaint({
        reporterId: 'user-1',
        reportedUserId: 'trainer-1',
      });

      expect(prisma.complaint.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gymSessionId: null }),
        })
      );
      expect(prisma.complaint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ gymSessionId: null, message: null }),
      });
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

    it('throws if the reported trainer does not exist', async () => {
      prisma.complaint.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        complaintService.createAutoNoHelpComplaint({
          reporterId: 'user-1',
          reportedUserId: 'ghost-trainer',
          gymSessionId: 'session-1',
        })
      ).rejects.toThrow('Reported user not found');
    });
  });

  describe('createAutoMachineConflictComplaint', () => {
    it('creates an AUTO_MACHINE_CONFLICT complaint linked to the conflict id', async () => {
      prisma.complaint.findFirst.mockResolvedValue(null);
      prisma.complaint.create.mockResolvedValue({
        id: 'complaint-1',
        reporterId: 'user-1',
        reportedUserId: 'user-2',
        source: 'AUTO_MACHINE_CONFLICT',
        message: 'conflict-1',
        status: 'PENDING',
      });

      const result = await complaintService.createAutoMachineConflictComplaint({
        reporterId: 'user-1',
        reportedUserId: 'user-2',
        conflictId: 'conflict-1',
      });

      expect(prisma.complaint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reporterId: 'user-1',
          reportedUserId: 'user-2',
          source: 'AUTO_MACHINE_CONFLICT',
          message: 'conflict-1',
          status: 'PENDING',
        }),
      });
      expect(result.source).toBe('AUTO_MACHINE_CONFLICT');
    });

    it('is idempotent: returns the existing complaint instead of duplicating it', async () => {
      const existing = { id: 'complaint-1', source: 'AUTO_MACHINE_CONFLICT' };
      prisma.complaint.findFirst.mockResolvedValue(existing);

      const result = await complaintService.createAutoMachineConflictComplaint({
        reporterId: 'user-1',
        reportedUserId: 'user-2',
        conflictId: 'conflict-1',
      });

      expect(result).toBe(existing);
      expect(prisma.complaint.create).not.toHaveBeenCalled();
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

    it('falls back to a null message when none is provided', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', role: 'USER' });
      prisma.complaint.create.mockResolvedValue({ id: 'complaint-2', source: 'TRAINER_REPORT' });

      await complaintService.createTrainerComplaint({
        reporterId: 'trainer-1',
        reportedUserId: 'user-2',
        reason: 'DAÑO_DE_MAQUINA',
      });

      expect(prisma.complaint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ message: null }),
      });
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

    it('throws if the reported member does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        complaintService.createTrainerComplaint({
          reporterId: 'trainer-1',
          reportedUserId: 'ghost',
          reason: 'MAL_COMPORTAMIENTO',
        })
      ).rejects.toThrow('Reported user not found');
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
