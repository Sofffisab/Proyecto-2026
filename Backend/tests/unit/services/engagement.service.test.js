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
  });
});
