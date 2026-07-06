import { describe, it, expect, vi, beforeEach } from "vitest";
import { processComplaints } from "../../../src/jobs/complaints.job.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/config/prisma.js", () => ({
  default: {
    complaint: {
      findMany: vi.fn(),
    },
    pointReviewRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("processComplaints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("does nothing if there are no PENDING complaints", async () => {
    prisma.complaint.findMany.mockResolvedValue([]);

    await processComplaints();

    expect(prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING" } })
    );
    expect(prisma.pointReviewRequest.create).not.toHaveBeenCalled();
  });

  it("flags a user with many PENDING complaints as suspicious behavior", async () => {
    const now = new Date();
    prisma.complaint.findMany.mockResolvedValue([
      { id: "c1", reportedUserId: "user-1", createdAt: now },
      { id: "c2", reportedUserId: "user-1", createdAt: now },
      { id: "c3", reportedUserId: "user-1", createdAt: now },
    ]);
    prisma.pointReviewRequest.findFirst.mockResolvedValue(null);
    prisma.pointReviewRequest.create.mockResolvedValue({});

    await processComplaints();

    expect(prisma.pointReviewRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.pointReviewRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        resolved: false,
        reason: expect.stringContaining("SUSPICIOUS_BEHAVIOR"),
      }),
    });
  });

  it("flags a complaint that has been PENDING for over 30 days", async () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 31);

    prisma.complaint.findMany.mockResolvedValue([
      { id: "c1", reportedUserId: "user-2", createdAt: staleDate },
    ]);
    prisma.pointReviewRequest.findFirst.mockResolvedValue(null);
    prisma.pointReviewRequest.create.mockResolvedValue({});

    await processComplaints();

    expect(prisma.pointReviewRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-2", resolved: false }),
    });
  });

  it("does not double-flag a user who already has an open suspicious-behavior alert", async () => {
    const now = new Date();
    prisma.complaint.findMany.mockResolvedValue([
      { id: "c1", reportedUserId: "user-1", createdAt: now },
      { id: "c2", reportedUserId: "user-1", createdAt: now },
      { id: "c3", reportedUserId: "user-1", createdAt: now },
    ]);
    prisma.pointReviewRequest.findFirst.mockResolvedValue({ id: "existing-alert" });

    await processComplaints();

    expect(prisma.pointReviewRequest.create).not.toHaveBeenCalled();
  });

  it("never changes a complaint's status directly (no auto-approve/reject)", async () => {
    prisma.complaint.findMany.mockResolvedValue([
      { id: "c1", reportedUserId: "user-1", createdAt: new Date() },
    ]);
    prisma.pointReviewRequest.findFirst.mockResolvedValue(null);
    prisma.pointReviewRequest.create.mockResolvedValue({});

    await processComplaints();

    expect(prisma.complaint.update).toBeUndefined();
    expect(prisma.complaint.updateMany).toBeUndefined();
  });
});
