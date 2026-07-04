import { describe, it, expect, vi, beforeEach } from "vitest";
import * as rewardService from "../../../src/services/reward.service.js";
import prisma from "../../../src/config/prisma.js";

describe("RewardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateReward", () => {
    it("rechaza si el usuario no tiene puntos suficientes", async () => {
      const mockReward = { id: "reward-1", name: "Coffee", pointsCost: 100, active: true };

      prisma.reward.findUnique.mockResolvedValue(mockReward);
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 50 } });

      await expect(rewardService.generateReward("user-123", "reward-1")).rejects.toThrow(
        "Not enough points"
      );
    });

    it("rechaza si el reward no está activo", async () => {
      prisma.reward.findUnique.mockResolvedValue({ id: "reward-1", active: false, pointsCost: 100 });

      await expect(rewardService.generateReward("user-123", "reward-1")).rejects.toThrow(
        "Reward is not available"
      );
    });

    it("deduce puntos y crea redemption con estado PENDING", async () => {
      const mockReward = { id: "reward-1", name: "Coffee", pointsCost: 100, active: true };

      prisma.reward.findUnique.mockResolvedValue(mockReward);
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 200 } });

      const mockTx = {
        pointTransaction: { create: vi.fn().mockResolvedValue({}) },
        rewardRedemption: {
          create: vi.fn().mockResolvedValue({
            id: "redemption-1",
            userId: "user-123",
            rewardId: "reward-1",
            status: "PENDING",
          }),
        },
      };
      prisma.$transaction.mockImplementation((fn) => fn(mockTx));

      const result = await rewardService.generateReward("user-123", "reward-1");

      expect(result.status).toBe("PENDING");
      expect(result.userId).toBe("user-123");
      expect(result.rewardId).toBe("reward-1");
      expect(mockTx.pointTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-123", points: -100 }),
      });
      expect(mockTx.rewardRedemption.create).toHaveBeenCalledWith({
        data: { userId: "user-123", rewardId: "reward-1", status: "PENDING" },
      });
    });
  });

  describe("approveReward / rejectReward", () => {
    it("aprueba una redemption PENDING", async () => {
      prisma.rewardRedemption.findUnique.mockResolvedValue({ id: "redemption-1", status: "PENDING" });
      prisma.rewardRedemption.update.mockResolvedValue({ id: "redemption-1", status: "APPROVED" });

      const result = await rewardService.approveReward("redemption-1", "admin-1");

      expect(result.status).toBe("APPROVED");
      expect(prisma.rewardRedemption.update).toHaveBeenCalledWith({
        where: { id: "redemption-1" },
        data: expect.objectContaining({ status: "APPROVED", approvedBy: "admin-1" }),
      });
    });

    it("rechaza aprobar una redemption que no está PENDING", async () => {
      prisma.rewardRedemption.findUnique.mockResolvedValue({ id: "redemption-1", status: "APPROVED" });

      await expect(rewardService.approveReward("redemption-1", "admin-1")).rejects.toThrow(
        "Cannot approve a redemption with status: APPROVED"
      );
    });

    it("rechazar una redemption reembolsa los puntos", async () => {
      const mockRedemption = {
        id: "redemption-1",
        status: "PENDING",
        userId: "user-123",
        reward: { pointsCost: 100, name: "Coffee" },
      };
      prisma.rewardRedemption.findUnique.mockResolvedValue(mockRedemption);

      const mockTx = {
        pointTransaction: { create: vi.fn().mockResolvedValue({}) },
        rewardRedemption: {
          update: vi.fn().mockResolvedValue({ id: "redemption-1", status: "REJECTED" }),
        },
      };
      prisma.$transaction.mockImplementation((fn) => fn(mockTx));

      const result = await rewardService.rejectReward("redemption-1", "admin-1");

      expect(result.status).toBe("REJECTED");
      expect(mockTx.pointTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-123", points: 100 }),
      });
    });
  });

  describe("getAvailableRewards", () => {
    it("lista rewards activos ordenados por costo", async () => {
      const mockRewards = [
        { id: "reward-1", name: "Coffee", pointsCost: 50 },
        { id: "reward-2", name: "Protein Shake", pointsCost: 100 },
      ];
      prisma.reward.findMany.mockResolvedValue(mockRewards);

      const result = await rewardService.getAvailableRewards();

      expect(result).toHaveLength(2);
      expect(prisma.reward.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { pointsCost: "asc" },
      });
    });
  });

  describe("getUserRedemptions", () => {
    it("lista redemptions del usuario ordenadas por fecha", async () => {
      const mockRedemptions = [{ id: "r-1", status: "PENDING" }];
      prisma.rewardRedemption.findMany.mockResolvedValue(mockRedemptions);

      const result = await rewardService.getUserRedemptions("user-123");

      expect(result).toEqual(mockRedemptions);
      expect(prisma.rewardRedemption.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        include: { reward: true },
        orderBy: { createdAt: "desc" },
      });
    });
  });
});
