import { describe, it, expect, vi, beforeEach } from "vitest";
import * as metrics from "../../../src/services/achievementMetrics.service.js";
import prisma from "../../../src/config/prisma.js";

function daysAgo(n, from = new Date("2026-07-07T12:00:00Z")) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

describe("achievementMetrics.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStreakDays", () => {
    it("counts consecutive days ending today", async () => {
      const now = new Date("2026-07-07T18:00:00Z");
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: daysAgo(0, now) },
        { checkInAt: daysAgo(1, now) },
        { checkInAt: daysAgo(2, now) },
      ]);

      const streak = await metrics.getStreakDays("user-1", now);
      expect(streak).toBe(3);
    });

    it("still counts the streak if today has no check-in yet but yesterday does", async () => {
      const now = new Date("2026-07-07T08:00:00Z");
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: daysAgo(1, now) },
        { checkInAt: daysAgo(2, now) },
      ]);

      const streak = await metrics.getStreakDays("user-1", now);
      expect(streak).toBe(2);
    });

    it("resets to 0 when there is a gap", async () => {
      const now = new Date("2026-07-07T12:00:00Z");
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: daysAgo(3, now) },
        { checkInAt: daysAgo(4, now) },
      ]);

      const streak = await metrics.getStreakDays("user-1", now);
      expect(streak).toBe(0);
    });

    it("returns 0 with no sessions at all", async () => {
      prisma.gymSession.findMany.mockResolvedValue([]);
      const streak = await metrics.getStreakDays("user-1", new Date());
      expect(streak).toBe(0);
    });
  });

  describe("getSocialInteractionsCount", () => {
    it("counts SocialInteraction rows for the user", async () => {
      prisma.socialInteraction.count.mockResolvedValue(4);
      const count = await metrics.getSocialInteractionsCount("user-1");
      expect(count).toBe(4);
      expect(prisma.socialInteraction.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    });
  });

  describe("getMachineUsesCount", () => {
    it("only counts completed (ended) machine usages", async () => {
      prisma.machineUsage.count.mockResolvedValue(7);
      const count = await metrics.getMachineUsesCount("user-1");
      expect(count).toBe(7);
      expect(prisma.machineUsage.count).toHaveBeenCalledWith({
        where: { userId: "user-1", endedAt: { not: null } },
      });
    });
  });

  describe("computeUserMetrics", () => {
    it("aggregates all metrics in one call", async () => {
      prisma.gymSession.findMany.mockResolvedValue([]);
      prisma.socialInteraction.count.mockResolvedValue(2);
      prisma.machineUsage.count.mockResolvedValue(9);
      prisma.gymSession.count.mockResolvedValue(12);
      prisma.machineUsage.findMany.mockResolvedValue([{ machineId: "a" }, { machineId: "b" }]);
      prisma.assistance.count.mockResolvedValue(3);

      const result = await metrics.computeUserMetrics("user-1", new Date("2026-07-07T12:00:00Z"));

      expect(result).toEqual({
        STREAK_DAYS: 0,
        STREAK_WEEKS: 0,
        STREAK_MONTHS: 0,
        SOCIAL_INTERACTIONS: 2,
        MACHINE_USES: 9,
        GYM_VISITS: 12,
        MACHINES_TRIED: 2,
        TRAINER_ASSISTANCES: 3,
      });
    });
  });

  describe("getWeekVisitsCount", () => {
    it("counts distinct visit days this week", async () => {
      const now = new Date(2026, 6, 8, 12); // Wednesday
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: new Date(2026, 6, 6, 9) },
        { checkInAt: new Date(2026, 6, 6, 18) },
        { checkInAt: new Date(2026, 6, 8, 9) },
      ]);
      expect(await metrics.getWeekVisitsCount("user-1", now)).toBe(2);
    });
  });
});
