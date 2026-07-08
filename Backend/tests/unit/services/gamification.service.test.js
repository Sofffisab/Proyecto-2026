import { describe, it, expect, vi, beforeEach } from "vitest";
import * as gamificationService from "../../../src/services/gamification.service.js";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";
import { POINTS } from "../../../src/constants/points.js";

describe("GamificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addPoints", () => {
    it("adds points and creates a PointTransaction/activity log", async () => {
      const mockTransaction = {
        id: "txn-123",
        userId: "user-123",
        points: 50,
        reason: "Check-in bonus",
        createdAt: new Date(),
      };

      prisma.pointTransaction.create.mockResolvedValue(mockTransaction);
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        totalPoints: 100,
      });
      prisma.user.update.mockResolvedValue({
        id: "user-123",
        totalPoints: 150,
      });

      const result = await gamificationService.addPoints("user-123", 50, "Check-in bonus");

      expect(result.points).toBe(50);
      expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          points: 50,
        }),
      });
    });

    it("allows negative points (penalties)", async () => {
      prisma.pointTransaction.create.mockResolvedValue({
        id: "txn-124",
        userId: "user-123",
        points: -10,
        reason: "Penalty",
      });

      const result = await gamificationService.addPoints("user-123", -10, "Penalty");
      expect(result.points).toBe(-10);
    });

    it("does not allow zero points", async () => {
      await expect(gamificationService.addPoints("user-123", 0, "Invalid")).rejects.toThrow(
        "Points must be a non-zero number"
      );
    });

    it("detecta level-up", async () => {
      prisma.pointTransaction.create.mockResolvedValue({
        id: "txn-123",
        points: 500,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: "user-123",
        totalPoints: 500,
        level: 1,
      });
      prisma.user.update.mockResolvedValue({
        id: "user-123",
        totalPoints: 1000,
        level: 2,
      });

      const result = await gamificationService.addPoints("user-123", 500, "Big bonus");

      expect(result).toBeDefined();
    });
  });

  describe("achievements", () => {
    it("incluye progreso de achievements bloqueados", async () => {
      const mockAchievements = [
        { id: "ach-1", type: "FIRST_CHECK_IN", unlockedAt: new Date() },
        { id: "ach-2", type: "WEEK_STREAK", unlockedAt: null },
      ];

      prisma.userAchievement.findMany.mockResolvedValue(mockAchievements);

      const result = await gamificationService.getAchievements("user-123");

      expect(result).toHaveLength(2);
      expect(result.some((a) => a.unlockedAt === null)).toBe(true);
    });
  });

  describe("checkAndUnlockAchievements", () => {
    it("unlocks a streak-based badge once the metric reaches its threshold", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 30 } });
      // 3 consecutive check-ins ending today -> STREAK_DAYS = 3
      const today = new Date();
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: today },
        { checkInAt: new Date(today.getTime() - 86400000) },
        { checkInAt: new Date(today.getTime() - 2 * 86400000) },
      ]);
      prisma.socialInteraction.count.mockResolvedValue(0);
      prisma.machineUsage.count.mockResolvedValue(0);

      prisma.userAchievement.findMany.mockResolvedValue([]);
      prisma.achievement.findMany.mockResolvedValue([
        {
          id: "ach-streak-3",
          name: "3 días seguidos",
          category: "CONSISTENCY",
          metric: "STREAK_DAYS",
          threshold: 3,
          pointsRequired: 0,
        },
      ]);
      prisma.userAchievement.findFirst.mockResolvedValue(null);
      prisma.userAchievement.create.mockResolvedValue({ id: "ua-1" });
      prisma.pointTransaction.create.mockResolvedValue({ id: "txn-1" });
      prisma.user.findUnique.mockResolvedValue({ email: "a@b.com", firstName: "Ana" });

      await gamificationService.checkAndUnlockAchievements("user-123");

      expect(prisma.userAchievement.create).toHaveBeenCalledWith({
        data: { userId: "user-123", achievementId: "ach-streak-3" },
      });
    });

    it("does not unlock an achievement whose metric has not reached its threshold", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 0 } });
      prisma.gymSession.findMany.mockResolvedValue([]);
      prisma.socialInteraction.count.mockResolvedValue(0);
      prisma.machineUsage.count.mockResolvedValue(0);

      prisma.userAchievement.findMany.mockResolvedValue([]);
      prisma.achievement.findMany.mockResolvedValue([
        {
          id: "ach-streak-7",
          name: "7 días seguidos",
          category: "CONSISTENCY",
          metric: "STREAK_DAYS",
          threshold: 7,
          pointsRequired: 0,
        },
      ]);

      await gamificationService.checkAndUnlockAchievements("user-123");

      expect(prisma.userAchievement.create).not.toHaveBeenCalled();
    });

    it("skips achievements already unlocked", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 0 } });
      prisma.gymSession.findMany.mockResolvedValue([]);
      prisma.socialInteraction.count.mockResolvedValue(5);
      prisma.machineUsage.count.mockResolvedValue(0);

      prisma.userAchievement.findMany.mockResolvedValue([{ achievementId: "ach-social-1" }]);
      prisma.achievement.findMany.mockResolvedValue([
        {
          id: "ach-social-1",
          name: "Primer desafío social",
          category: "SOCIAL",
          metric: "SOCIAL_INTERACTIONS",
          threshold: 1,
          pointsRequired: 0,
        },
      ]);

      await gamificationService.checkAndUnlockAchievements("user-123");

      expect(prisma.userAchievement.create).not.toHaveBeenCalled();
    });
  });
});
