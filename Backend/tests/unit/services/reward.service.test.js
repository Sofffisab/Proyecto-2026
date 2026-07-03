import { describe, it, expect, vi, beforeEach } from "vitest";
import * as rewardService from "../../../src/services/reward.service.js";
import prisma from "../../../src/config/prisma.js";

describe("RewardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("redeemReward", () => {
    it("rechaza si el usuario no tiene puntos suficientes", async () => {
      const mockUser = { id: "user-123", totalPoints: 50 };
      const mockReward = { id: "reward-1", cost: 100 };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.reward.findUnique.mockResolvedValue(mockReward);

      await expect(rewardService.redeemReward("user-123", "reward-1")).rejects.toThrow(
        "insufficient points"
      );
    });

    it("deduce puntos correctamente al canjear", async () => {
      const mockUser = { id: "user-123", totalPoints: 200 };
      const mockReward = { id: "reward-1", cost: 100 };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.reward.findUnique.mockResolvedValue(mockReward);
      prisma.user.update.mockResolvedValue({
        id: "user-123",
        totalPoints: 100,
      });
      prisma.redemption.create.mockResolvedValue({
        id: "redemption-1",
        userId: "user-123",
        rewardId: "reward-1",
        status: "PENDING",
      });

      const result = await rewardService.redeemReward("user-123", "reward-1");

      expect(result.status).toBe("PENDING");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { totalPoints: 100 },
      });
    });

    it("crea registro de redemption con estado inicial", async () => {
      const mockUser = { id: "user-123", totalPoints: 200 };
      const mockReward = { id: "reward-1", cost: 100 };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.reward.findUnique.mockResolvedValue(mockReward);
      prisma.user.update.mockResolvedValue({ totalPoints: 100 });
      prisma.redemption.create.mockResolvedValue({
        id: "redemption-1",
        userId: "user-123",
        rewardId: "reward-1",
        status: "PENDING",
        createdAt: new Date(),
      });

      const result = await rewardService.redeemReward("user-123", "reward-1");

      expect(result.userId).toBe("user-123");
      expect(result.rewardId).toBe("reward-1");
      expect(prisma.redemption.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          rewardId: "reward-1",
          status: "PENDING",
        }),
      });
    });
  });

  describe("updateRedemptionStatus", () => {
    it("cambia estado válido (PENDING → APPROVED → COMPLETED)", async () => {
      const mockRedemption = {
        id: "redemption-1",
        status: "PENDING",
        userId: "user-123",
      };

      prisma.redemption.findUnique.mockResolvedValue(mockRedemption);
      prisma.redemption.update.mockResolvedValue({
        ...mockRedemption,
        status: "APPROVED",
      });

      const result = await rewardService.updateRedemptionStatus("redemption-1", "APPROVED");

      expect(result.status).toBe("APPROVED");
    });

    it("rechaza transición inválida de estado", async () => {
      const mockRedemption = {
        id: "redemption-1",
        status: "COMPLETED",
        userId: "user-123",
      };

      prisma.redemption.findUnique.mockResolvedValue(mockRedemption);

      await expect(
        rewardService.updateRedemptionStatus("redemption-1", "PENDING")
      ).rejects.toThrow("invalid state transition");
    });
  });

  describe("getRewards", () => {
    it("lista rewards disponibles con paginación", async () => {
      const mockRewards = [
        { id: "reward-1", name: "Coffee", cost: 50 },
        { id: "reward-2", name: "Protein Shake", cost: 100 },
        { id: "reward-3", name: "Gym Merch", cost: 200 },
      ];

      prisma.reward.findMany.mockResolvedValue(mockRewards);

      const result = await rewardService.getRewards({ limit: 10, offset: 0 });

      expect(result).toHaveLength(3);
      expect(prisma.reward.findMany).toHaveBeenCalledWith({
        where: { available: true },
        take: 10,
        skip: 0,
      });
    });
  });

  describe("getRedemptions", () => {
    it("lista redemptions del usuario con filtro por status", async () => {
      const mockRedemptions = [
        { id: "r-1", status: "PENDING", createdAt: new Date() },
        { id: "r-2", status: "APPROVED", createdAt: new Date() },
      ];

      prisma.redemption.findMany.mockResolvedValue(mockRedemptions);

      const result = await rewardService.getRedemptions("user-123", {
        status: "PENDING",
        limit: 10,
      });

      expect(result).toBeDefined();
    });
  });
});
