import { describe, it, expect, beforeEach, vi } from 'vitest';
import { complaintService } from '../../../src/services/complaint.service.js';
import { prisma } from '../../../src/config/prisma.js';

vi.mock('../../../src/config/prisma.js');

describe('ComplaintService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea queja en estado PENDING', async () => {
    const mockComplaint = {
      id: 'complaint-1',
      userId: 'user-1',
      status: 'PENDING',
      createdAt: new Date(),
    };

    prisma.complaint.create.mockResolvedValue(mockComplaint);

    const result = await complaintService.create('user-1', { subject: 'Test' });

    expect(result.status).toBe('PENDING');
    expect(prisma.complaint.create).toHaveBeenCalled();
  });

  it('resolve setea reviewedAt y resolution', async () => {
    const mockResolved = {
      id: 'complaint-1',
      status: 'RESOLVED',
      reviewedAt: new Date(),
      resolution: 'Fixed issue',
    };

    prisma.complaint.update.mockResolvedValue(mockResolved);

    const result = await complaintService.resolve('complaint-1', 'Fixed issue');

    expect(result.status).toBe('RESOLVED');
    expect(result.reviewedAt).toBeDefined();
    expect(result.resolution).toBe('Fixed issue');
  });

  it('reject setea reviewedAt sin resolution positiva', async () => {
    const mockRejected = {
      id: 'complaint-1',
      status: 'REJECTED',
      reviewedAt: new Date(),
      resolution: null,
    };

    prisma.complaint.update.mockResolvedValue(mockRejected);

    const result = await complaintService.reject('complaint-1');

    expect(result.status).toBe('REJECTED');
    expect(result.reviewedAt).toBeDefined();
  });

  it('getMyComplaints filtra solo por el usuario autenticado', async () => {
    const mockComplaints = [
      { id: 'complaint-1', userId: 'user-1' },
      { id: 'complaint-2', userId: 'user-1' },
    ];

    prisma.complaint.findMany.mockResolvedValue(mockComplaints);

    const result = await complaintService.getMyComplaints('user-1');

    expect(prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      })
    );
    expect(result).toHaveLength(2);
    expect(result.every(c => c.userId === 'user-1')).toBe(true);
  });

  it('getAdminComplaints devuelve todas (sin filtro de usuario)', async () => {
    const mockComplaints = [
      { id: 'complaint-1', userId: 'user-1' },
      { id: 'complaint-2', userId: 'user-2' },
    ];

    prisma.complaint.findMany.mockResolvedValue(mockComplaints);

    const result = await complaintService.getAdminComplaints();

    expect(prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        where: { userId: expect.anything() },
      })
    );
    expect(result).toHaveLength(2);
  });
});
