import { describe, it, expect, vi, beforeEach } from "vitest";
import { recalculatePoints } from "../../../src/jobs/points.job.js";
import prisma from "../../../src/config/prisma.js";

// Mock the global Prisma client
vi.mock("../../../src/config/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
    },
    pointTransaction: {
      aggregate: vi.fn(),
    },
  },
}));

describe("recalculatePoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates points per user via prisma.pointTransaction.aggregate", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
    prisma.pointTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { points: 150 } })
      .mockResolvedValueOnce({ _sum: { points: null } }); // null produce 0 pts

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await recalculatePoints();

    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.pointTransaction.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.pointTransaction.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      _sum: { points: true },
    });

    const logs = consoleSpy.mock.calls.flat().join(" ");
    expect(logs).toContain("[points.job] User user-1 total: 150 pts");
    expect(logs).toContain("[points.job] User user-2 total: 0 pts");
    consoleSpy.mockRestore();
  });

  it("an error for one user does not break the loop (processed/failed are correct)", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
    
    // The first one fails, the second one succeeds
    prisma.pointTransaction.aggregate
      .mockRejectedValueOnce(new Error("DB Timeout"))
      .mockResolvedValueOnce({ _sum: { points: 50 } });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    await expect(recalculatePoints()).resolves.not.toThrow();

    expect(prisma.pointTransaction.aggregate).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[points.job] Failed to process user user-1:"),
      expect.any(String)
    );
    errorSpy.mockRestore();
  });

  it("propagates the error if the initial user fetch fails", async () => {
    prisma.user.findMany.mockRejectedValue(new Error("Connection error"));

    await expect(recalculatePoints()).rejects.toThrow("Connection error");
  });
});

