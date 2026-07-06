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
    prisma.pointTransaction.create.mockResolvedValue({});
    prisma.notification.create.mockResolvedValue({});

    const result = await complaintService.approveComplaint('complaint-1', 'admin-1');

    expect(result.status).toBe('APPROVED');
    expect(result.reviewedAt).toBeDefined();
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
});
