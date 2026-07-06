import { describe, it, expect, vi, beforeEach } from "vitest";
import * as engagementService from "../../../src/services/engagement.service.js";
import prisma from "../../../src/config/prisma.js";

describe("EngagementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllAchievements", () => {
    it("returns achievements ordered by points required", async () => {
      const mockAchievements = [{ id: "a1", pointsRequired: 100 }];
      prisma.achievement.findMany.mockResolvedValue(mockAchievements);

      const result = await engagementService.getAllAchievements();

      expect(prisma.achievement.findMany).toHaveBeenCalledWith({
        orderBy: { pointsRequired: "asc" },
      });
      expect(result).toEqual(mockAchievements);
    });
  });

  describe("getLeaderboard", () => {
    it("groups point transactions by user and sorts by total desc", async () => {
      prisma.pointTransaction.groupBy.mockResolvedValue([
        { userId: "user-1", _sum: { points: 500 } },
        { userId: "user-2", _sum: { points: 300 } },
      ]);

      const result = await engagementService.getLeaderboard(10);

      expect(result).toEqual([
        { userId: "user-1", totalPoints: 500 },
        { userId: "user-2", totalPoints: 300 },
      ]);
    });
  });

  describe("getLeaderboardWithNames", () => {
    it("enriches leaderboard rows with first/last name in a single extra query", async () => {
      prisma.pointTransaction.groupBy.mockResolvedValue([
        { userId: "user-1", _sum: { points: 500 } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: "user-1", firstName: "Ana", lastName: "Gomez" },
      ]);

      const result = await engagementService.getLeaderboardWithNames(10);

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(result).toEqual([
        { rank: 1, userId: "user-1", firstName: "Ana", lastName: "Gomez", totalPoints: 500 },
      ]);
    });

    it("falls back to empty names if the user record is missing", async () => {
      prisma.pointTransaction.groupBy.mockResolvedValue([
        { userId: "ghost-user", _sum: { points: 10 } },
      ]);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await engagementService.getLeaderboardWithNames(10);

      expect(result[0].firstName).toBe("");
      expect(result[0].lastName).toBe("");
    });
  });

  describe("getUserRank", () => {
    it("computes rank as the count of users with strictly more points, plus one", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 200 } });
      prisma.pointTransaction.groupBy.mockResolvedValue([
        { userId: "user-2" },
        { userId: "user-3" },
      ]);

      const result = await engagementService.getUserRank("user-1");

      expect(result).toEqual({ rank: 3, totalPoints: 200 });
    });

    it("ranks #1 when no one has more points", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 1000 } });
      prisma.pointTransaction.groupBy.mockResolvedValue([]);

      const result = await engagementService.getUserRank("user-1");

      expect(result).toEqual({ rank: 1, totalPoints: 1000 });
    });
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
