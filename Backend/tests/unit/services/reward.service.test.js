import { describe, it, expect, vi, beforeEach } from "vitest";
import * as rewardService from "../../../src/services/reward.service.js";
import prisma from "../../../src/config/prisma.js";

describe("RewardService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("autoGrantRewards", () => {
    it("grants nothing if the user has not reached any reward threshold", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 50 } });
      prisma.reward.findMany.mockResolvedValue([]);

      const result = await rewardService.autoGrantRewards("user-123");

      expect(result).toBeNull();
      expect(prisma.reward.findMany).toHaveBeenCalledWith({
        where: { active: true, stock: { gt: 0 }, pointsCost: { lte: 50 } },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("grants nothing when no eligible reward currently has stock", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 200 } });
      prisma.reward.findMany.mockResolvedValue([]);

      const result = await rewardService.autoGrantRewards("user-123");

      expect(result).toBeNull();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("automatically ships the reward, decrements stock, and resets points to 0", async () => {
      const mockReward = { id: "reward-1", name: "Coffee", pointsCost: 100, active: true, stock: 3 };

      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 200 } });
      prisma.reward.findMany.mockResolvedValue([mockReward]);
      prisma.user.findUnique.mockResolvedValue({ email: "user@test.com", firstName: "Juan" });

      const mockTx = {
        reward: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        pointTransaction: { create: vi.fn().mockResolvedValue({}) },
        rewardRedemption: {
          create: vi.fn().mockResolvedValue({
            id: "redemption-1",
            userId: "user-123",
            rewardId: "reward-1",
            status: "SHIPPED",
          }),
        },
      };
      prisma.$transaction.mockImplementation((fn) => fn(mockTx));

      const result = await rewardService.autoGrantRewards("user-123");

      expect(result.status).toBe("SHIPPED");
      expect(mockTx.reward.updateMany).toHaveBeenCalledWith({
        where: { id: "reward-1", stock: { gt: 0 } },
        data: { stock: { decrement: 1 } },
      });
      // The full accumulated balance is wiped out — not just the reward's cost.
      expect(mockTx.pointTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-123", points: -200 }),
      });
      expect(mockTx.rewardRedemption.create).toHaveBeenCalledWith({
        data: { userId: "user-123", rewardId: "reward-1", status: "SHIPPED" },
      });
    });

    it("bails out without granting if stock was claimed concurrently", async () => {
      const mockReward = { id: "reward-1", name: "Coffee", pointsCost: 100, active: true, stock: 1 };

      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 200 } });
      prisma.reward.findMany.mockResolvedValue([mockReward]);

      const mockTx = {
        reward: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        pointTransaction: { create: vi.fn() },
        rewardRedemption: { create: vi.fn() },
      };
      prisma.$transaction.mockImplementation((fn) => fn(mockTx));

      const result = await rewardService.autoGrantRewards("user-123");

      expect(result).toBeNull();
      expect(mockTx.pointTransaction.create).not.toHaveBeenCalled();
      expect(mockTx.rewardRedemption.create).not.toHaveBeenCalled();
    });

    it("does nothing when total points is 0 or negative", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 0 } });

      const result = await rewardService.autoGrantRewards("user-123");

      expect(result).toBeNull();
      expect(prisma.reward.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("deliverReward", () => {
    it("marks a SHIPPED redemption as DELIVERED", async () => {
      prisma.rewardRedemption.findUnique.mockResolvedValue({ id: "redemption-1", status: "SHIPPED" });
      prisma.rewardRedemption.update.mockResolvedValue({ id: "redemption-1", status: "DELIVERED" });

      const result = await rewardService.deliverReward("redemption-1");

      expect(result.status).toBe("DELIVERED");
      expect(prisma.rewardRedemption.update).toHaveBeenCalledWith({
        where: { id: "redemption-1" },
        data: expect.objectContaining({ status: "DELIVERED" }),
      });
    });

    it("rejects delivering a redemption that isn't SHIPPED", async () => {
      prisma.rewardRedemption.findUnique.mockResolvedValue({ id: "redemption-1", status: "DELIVERED" });

      await expect(rewardService.deliverReward("redemption-1")).rejects.toThrow(
        "Cannot deliver a redemption with status: DELIVERED"
      );
    });
  });

  describe("getAvailableRewards", () => {
    it("lists active rewards ordered by cost, without stock/isMarketingItem", async () => {
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
        select: {
          id: true,
          name: true,
          description: true,
          pointsCost: true,
          active: true,
          createdAt: true,
        },
      });
    });
  });

  describe("getAllRewardsAdmin", () => {
    it("lists every reward including stock and isMarketingItem", async () => {
      const mockRewards = [
        { id: "reward-1", name: "Coffee", pointsCost: 50, stock: 10, isMarketingItem: false },
        { id: "reward-2", name: "Sponsor Towel", pointsCost: 100, stock: 2, isMarketingItem: true },
      ];
      prisma.reward.findMany.mockResolvedValue(mockRewards);

      const result = await rewardService.getAllRewardsAdmin();

      expect(result).toEqual(mockRewards);
      expect(prisma.reward.findMany).toHaveBeenCalledWith({
        orderBy: { pointsCost: "asc" },
      });
    });
  });

  describe("getUserRedemptions", () => {
    it("lists the user redemptions ordered by date", async () => {
      const mockRedemptions = [{ id: "r-1", status: "SHIPPED" }];
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
