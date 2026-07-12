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

  describe("getFullHistoryAdmin", () => {
    const baseUsers = [
      {
        id: "user-1",
        firstName: "Ana",
        lastName: "Gomez",
        email: "ana@example.com",
        settings: { analyticsConsent: true },
        gymSessions: [{ id: "s1", checkInAt: new Date(), checkOutAt: new Date(), durationMinutes: 30 }],
        machineUsages: [{ id: "m1", startedAt: new Date(), endedAt: new Date(), durationMinutes: 10, machine: { name: "Treadmill", zone: "Cardio" } }],
      },
      {
        id: "user-2",
        firstName: "Ben",
        lastName: "Lee",
        email: "ben@example.com",
        settings: { analyticsConsent: false }, // withdrew consent
        gymSessions: [],
        machineUsages: [],
      },
    ];

    it("defaults to fully pseudonymous rows (no identifiers) even when not asked otherwise", async () => {
      prisma.user.findMany.mockResolvedValue(baseUsers);

      const result = await insightsService.getFullHistoryAdmin();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: "USER" } })
      );
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBeUndefined();
      expect(result[0].name).toBeUndefined();
      expect(result[0].pseudoId).toBeDefined();
      expect(result[0].totalSessions).toBe(1);
      expect(result[0].totalMinutes).toBe(30);
    });

    it("attaches real identifiers only for consented users when includeIdentifiers=true", async () => {
      prisma.user.findMany.mockResolvedValue(baseUsers);

      const result = await insightsService.getFullHistoryAdmin({ includeIdentifiers: true });

      const consentedUser = result.find((r) => r.totalSessions === 1);
      const withdrawnUser = result.find((r) => r.totalSessions === 0);

      expect(consentedUser.name).toBe("Ana Gomez");
      expect(consentedUser.email).toBe("ana@example.com");
      // Withdrawn consent overrides includeIdentifiers — never de-anonymized.
      expect(withdrawnUser.name).toBeUndefined();
      expect(withdrawnUser.email).toBeUndefined();
      expect(withdrawnUser.consented).toBe(false);
    });

    it("returns an empty array when there are no USER-role accounts", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await insightsService.getFullHistoryAdmin();

      expect(result).toEqual([]);
    });
  });
});
