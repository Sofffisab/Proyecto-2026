import { describe, it, expect, vi, beforeEach } from "vitest";
import * as insightsService from "../../../src/services/insights.service.js";
import prisma from "../../../src/config/prisma.js";

describe("InsightsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserAnalytics", () => {
    it("handles an empty dataset without throwing", async () => {
      prisma.gymSession.findMany.mockResolvedValue([]);
      prisma.machineUsage.findMany.mockResolvedValue([]);

      const result = await insightsService.getUserAnalytics("user-123");

      expect(result).toBeDefined();
      expect(result.total.sessions).toBe(0);
      expect(result.total.minutes).toBe(0);
      expect(result.machineUsage).toEqual({});
    });

    it("calculates correctly with a single record", async () => {
      const now = new Date();
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: now, durationMinutes: 45 },
      ]);
      prisma.machineUsage.findMany.mockResolvedValue([
        { machine: { name: "Treadmill" } },
      ]);

      const result = await insightsService.getUserAnalytics("user-123");

      expect(result.total.sessions).toBe(1);
      expect(result.total.minutes).toBe(45);
      expect(result.machineUsage).toEqual({ Treadmill: 1 });
    });

    it("calculates correctly with multiple records/outliers", async () => {
      const now = new Date();
      const oldDate = new Date(now.getFullYear() - 1, 0, 1);
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: now, durationMinutes: 30 },
        { checkInAt: now, durationMinutes: 500 },
        { checkInAt: oldDate, durationMinutes: 20 },
      ]);
      prisma.machineUsage.findMany.mockResolvedValue([]);

      const result = await insightsService.getUserAnalytics("user-123");

      expect(result.total.sessions).toBe(3);
      expect(result.total.minutes).toBe(550);
      // The outdated session shouldn't be counted in the monthly bucket
      expect(result.monthly.sessions).toBeLessThan(3);
    });
    it("returns goalProgress=null when the user hasn't set a weekly frequency goal", async () => {
      prisma.gymSession.findMany.mockResolvedValue([]);
      prisma.machineUsage.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({
        objectives: [],
        trainingLevel: null,
        weeklyTrainingDays: null,
        trainingType: null,
      });

      const result = await insightsService.getUserAnalytics("user-123");

      expect(result.goalProgress).toBeNull();
    });

    it("compares actual weekly check-ins against the declared frequency goal", async () => {
      const now = new Date();
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: now, durationMinutes: 30 },
        { checkInAt: now, durationMinutes: 30 },
        { checkInAt: now, durationMinutes: 30 },
      ]);
      prisma.machineUsage.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({
        objectives: ["GAIN_MUSCLE"],
        trainingLevel: "INTERMEDIATE",
        weeklyTrainingDays: "FOUR",
        trainingType: "STRENGTH",
      });

      const result = await insightsService.getUserAnalytics("user-123");

      expect(result.goalProgress).toEqual({
        mainGoal: ["GAIN_MUSCLE"],
        trainingLevel: "INTERMEDIATE",
        trainingType: "STRENGTH",
        weeklyTrainingDaysGoal: "FOUR",
        targetDaysPerWeek: 4,
        actualDaysThisWeek: 3,
        onTrack: false,
      });
    });
  });

  describe("getGymAnalytics", () => {
    it("returns the gym's global totals", async () => {
      prisma.gymSession.count.mockResolvedValue(42);
      prisma.user.count.mockResolvedValue(10);

      const result = await insightsService.getGymAnalytics();

      expect(result).toEqual({ totalSessions: 42, activeUsers: 10 });
      expect(prisma.user.count).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });
});
