import { describe, it, expect, vi, beforeEach } from "vitest";
import { processComplaints } from "../../../jobs/complaints.job.js";
import prisma from "../../../config/prisma.js";

vi.mock("../../../config/prisma.js", () => ({
  default: {
    complaint: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe("processComplaints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("no hace nada si no hay quejas PENDING de más de 30 días", async () => {
    prisma.complaint.findMany.mockResolvedValue([]);

    await processComplaints();

    expect(prisma.complaint.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.complaint.updateMany).not.toHaveBeenCalled();
  });

  it("auto-cierra (REJECTED) quejas con createdAt < cutoff, reviewedBy null", async () => {
    prisma.complaint.findMany.mockResolvedValue([{ id: "complaint-1" }, { id: "complaint-2" }]);
    prisma.complaint.updateMany.mockResolvedValue({ count: 2 });

    await processComplaints();

    expect(prisma.complaint.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          createdAt: expect.any(Object),
        }),
      })
    );

    expect(prisma.complaint.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["complaint-1", "complaint-2"] } },
      data: {
        status: "REJECTED",
        reviewedBy: null,
        reviewedAt: expect.any(Date),
        resolution: "Auto-closed after 30 days with no admin action.",
      },
    });
  });
});