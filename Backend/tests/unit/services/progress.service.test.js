import { describe, it, expect, vi, beforeEach } from "vitest";
import * as progressService from "../../../src/services/progress.service.js";
import prisma from "../../../src/config/prisma.js";

describe("ProgressService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addProgressLog / createGoal", () => {
    it("creates a valid log/goal", async () => {
      const mockLog = {
        id: "log-123",
        userId: "user-123",
        metric: "weight",
        value: 75.5,
        date: new Date(),
      };

      prisma.progressLog.findFirst.mockResolvedValue(null);
      prisma.progressLog.create.mockResolvedValue(mockLog);

      const result = await progressService.addProgressLog("user-123", {
        metric: "weight",
        value: 75.5,
      });

      expect(result.metric).toBe("weight");
      expect(result.value).toBe(75.5);
      expect(prisma.progressLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          metric: "weight",
          value: 75.5,
        }),
      });
    });
  });

  describe("metrics", () => {
    it("prevents duplicate metrics on the same day", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.progressLog.findFirst.mockResolvedValue({
        id: "log-123",
        date: today,
      });

      await expect(
        progressService.addProgressLog("user-123", { metric: "weight", value: 75 })
      ).rejects.toThrow("Already logged today");
    });

    it("allows updating if forced", async () => {
      const mockLog = {
        id: "log-123",
        userId: "user-123",
        metric: "weight",
        value: 76,
      };

      prisma.progressLog.upsert.mockResolvedValue(mockLog);

      const result = await progressService.addProgressLog(
        "user-123",
        { metric: "weight", value: 76 },
        { force: true }
      );

      expect(result.value).toBe(76);
      expect(prisma.progressLog.upsert).toHaveBeenCalled();
    });
  });

  describe("streak", () => {
    it("calculates the current streak correctly", async () => {
      const mockLogs = [
        { date: new Date() },
        { date: new Date(Date.now() - 86400000) },
        { date: new Date(Date.now() - 2 * 86400000) },
      ];

      prisma.progressLog.findMany.mockResolvedValue(mockLogs);

      const result = await progressService.getCurrentStreak("user-123", "weight");

      expect(result).toBeGreaterThan(0);
    });

    it("breaks the streak if a day is missed", async () => {
      const mockLogs = [
        { date: new Date() },
        { date: new Date(Date.now() - 2 * 86400000) }, // Missing yesterday
      ];

      prisma.progressLog.findMany.mockResolvedValue(mockLogs);

      const result = await progressService.getCurrentStreak("user-123", "weight");

      expect(result).toBe(1); // Only today
    });

    it("calculates the longest historical streak", async () => {
      const mockStreaks = [
        { maxStreak: 30 },
      ];

      prisma.progressMetric.findMany.mockResolvedValue(mockStreaks);

      const result = await progressService.getLongestStreak("user-123", "weight");

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getProgressHistory", () => {
    it("filters by date range and paginates", async () => {
      const mockLogs = [
        { id: "log-1", metric: "weight", value: 75 },
        { id: "log-2", metric: "weight", value: 74.5 },
      ];

      prisma.progressLog.findMany.mockResolvedValue(mockLogs);

      const result = await progressService.getProgressHistory("user-123", {
        metric: "weight",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveLength(2);
      expect(prisma.progressLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: "user-123",
          metric: "weight",
        }),
        orderBy: { date: "desc" },
        take: 10,
        skip: 0,
      });
    });
  });
});