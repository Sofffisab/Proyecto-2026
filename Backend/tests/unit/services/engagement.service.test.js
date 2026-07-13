import { describe, it, expect, vi, beforeEach } from "vitest";
import * as engagementService from "../../../src/services/engagement.service.js";
import prisma from "../../../src/config/prisma.js";

describe("EngagementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEngagementMetrics", () => {
    it("aggregates users, sessions and total points awarded", async () => {
      prisma.user.count
        .mockResolvedValueOnce(50) // totalUsers
        .mockResolvedValueOnce(40); // activeUsers
      prisma.gymSession.count.mockResolvedValue(120);
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 9000 } });

      const result = await engagementService.getEngagementMetrics();

      expect(result).toEqual({
        totalUsers: 50,
        activeUsers: 40,
        totalSessions: 120,
        totalPointsAwarded: 9000,
      });
    });

    it("reports 0 total points awarded when there are no point transactions yet (aggregate sum is null)", async () => {
      prisma.user.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      prisma.gymSession.count.mockResolvedValue(0);
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: null } });

      const result = await engagementService.getEngagementMetrics();

      expect(result.totalPointsAwarded).toBe(0);
    });
  });
});
