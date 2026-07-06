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
    it("unlocks an achievement and grants points", async () => {
      const mockAchievement = {
        id: "ach-123",
        userId: "user-123",
        achievementType: "FIRST_CHECK_IN",
        unlockedAt: new Date(),
      };

      prisma.userAchievement.findUnique.mockResolvedValue(null);
      prisma.userAchievement.create.mockResolvedValue(mockAchievement);
      prisma.pointTransaction.create.mockResolvedValue({
        id: "txn-123",
        points: 100,
      });

      const result = await gamificationService.unlockAchievement(
        "user-123",
        "FIRST_CHECK_IN"
      );

      expect(result.unlockedAt).toBeDefined();
      expect(prisma.userAchievement.create).toHaveBeenCalled();
    });

    it("does not allow unlocking the same achievement twice", async () => {
      prisma.userAchievement.findUnique.mockResolvedValue({
        id: "ach-123",
        unlockedAt: new Date(),
      });

      await expect(
        gamificationService.unlockAchievement("user-123", "FIRST_CHECK_IN")
      ).rejects.toThrow("already unlocked");
    });

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
});
