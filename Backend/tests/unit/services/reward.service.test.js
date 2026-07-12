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

    it("queues a pending grant when the user qualifies by points but nothing is in stock", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 150 } });
      prisma.reward.findMany.mockResolvedValue([]); // nothing in stock
      prisma.reward.findFirst.mockResolvedValue({ id: "reward-1", pointsCost: 100 }); // but qualifies
      prisma.rewardPendingGrant.findFirst.mockResolvedValue(null); // not already queued
      prisma.rewardPendingGrant.create.mockResolvedValue({ id: "pending-1" });

      const result = await rewardService.autoGrantRewards("user-123");

      expect(result).toBeNull();
      expect(prisma.rewardPendingGrant.create).toHaveBeenCalledWith({
        data: { userId: "user-123", pointsAtQueueTime: 150 },
      });
    });

    it("does not create a duplicate pending grant if one is already open", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 150 } });
      prisma.reward.findMany.mockResolvedValue([]);
      prisma.reward.findFirst.mockResolvedValue({ id: "reward-1", pointsCost: 100 });
      prisma.rewardPendingGrant.findFirst.mockResolvedValue({
        id: "pending-1",
        pointsAtQueueTime: 150,
      });

      await rewardService.autoGrantRewards("user-123");

      expect(prisma.rewardPendingGrant.create).not.toHaveBeenCalled();
      expect(prisma.rewardPendingGrant.update).not.toHaveBeenCalled();
    });

    it("refreshes the points snapshot on an already-open pending grant if it changed", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 180 } });
      prisma.reward.findMany.mockResolvedValue([]);
      prisma.reward.findFirst.mockResolvedValue({ id: "reward-1", pointsCost: 100 });
      prisma.rewardPendingGrant.findFirst.mockResolvedValue({
        id: "pending-1",
        pointsAtQueueTime: 150,
      });

      await rewardService.autoGrantRewards("user-123");

      expect(prisma.rewardPendingGrant.update).toHaveBeenCalledWith({
        where: { id: "pending-1" },
        data: { pointsAtQueueTime: 180 },
      });
    });

    it("does not queue if the user doesn't qualify for any reward by points", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 10 } });
      prisma.reward.findMany.mockResolvedValue([]);
      prisma.reward.findFirst.mockResolvedValue(null); // no reward costs <= 10 points

      await rewardService.autoGrantRewards("user-123");

      expect(prisma.rewardPendingGrant.create).not.toHaveBeenCalled();
    });

    it("clamps the balance and raises a review request when it hits the hard cap with nothing grantable", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 9999 } });
      prisma.reward.findMany.mockResolvedValue([]); // nothing in stock
      prisma.reward.findFirst.mockResolvedValue(null); // nothing affordable either
      prisma.pointTransaction.create.mockResolvedValue({});
      prisma.pointReviewRequest.create.mockResolvedValue({});

      await rewardService.autoGrantRewards("user-123");

      expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "user-123", points: -1 }),
        })
      );
      expect(prisma.pointReviewRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "user-123", resolved: false }),
        })
      );
    });

    it("does not raise a review request if the hard cap fires but raising it fails (logged, not thrown)", async () => {
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 10000 } });
      prisma.reward.findMany.mockResolvedValue([]);
      prisma.reward.findFirst.mockResolvedValue(null);
      prisma.pointTransaction.create.mockResolvedValue({});
      prisma.pointReviewRequest.create.mockRejectedValue(new Error("db down"));

      await expect(rewardService.autoGrantRewards("user-123")).resolves.toBeNull();
    });

    it("closes out an open pending grant once a reward is actually shipped", async () => {
      const mockReward = { id: "reward-1", name: "Coffee", pointsCost: 100, active: true, stock: 3 };

      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: 200 } });
      prisma.reward.findMany.mockResolvedValue([mockReward]);
      prisma.user.findUnique.mockResolvedValue({ email: "user@test.com", firstName: "Juan" });

      const mockTx = {
        reward: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        pointTransaction: { create: vi.fn().mockResolvedValue({}) },
        rewardRedemption: {
          create: vi.fn().mockResolvedValue({ id: "redemption-1", status: "SHIPPED" }),
        },
        rewardPendingGrant: {
          findFirst: vi.fn().mockResolvedValue({ id: "pending-1" }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation((fn) => fn(mockTx));

      await rewardService.autoGrantRewards("user-123");

      expect(mockTx.rewardPendingGrant.update).toHaveBeenCalledWith({
        where: { id: "pending-1" },
        data: { fulfilledAt: expect.any(Date), fulfilledRedemptionId: "redemption-1" },
      });
    });
  });

  describe("getPendingGrants", () => {
    it("lists unfulfilled pending grants oldest first, with user info", async () => {
      const mockPending = [{ id: "pending-1", userId: "user-123", pointsAtQueueTime: 150, fulfilledAt: null }];
      prisma.rewardPendingGrant.findMany.mockResolvedValue(mockPending);

      const result = await rewardService.getPendingGrants();

      expect(result).toEqual(mockPending);
      expect(prisma.rewardPendingGrant.findMany).toHaveBeenCalledWith({
        where: { fulfilledAt: null },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
    });
  });

  describe("fulfillPendingGrants", () => {
    it("retries every open pending grant and reports how many were fulfilled", async () => {
      prisma.rewardPendingGrant.findMany.mockResolvedValue([
        { id: "pending-1", userId: "user-1" },
        { id: "pending-2", userId: "user-2" },
      ]);

      // First user now succeeds (stock available), second still has none.
      prisma.pointTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { points: 200 } })
        .mockResolvedValueOnce({ _sum: { points: 200 } });

      const mockReward = { id: "reward-1", name: "Coffee", pointsCost: 100, active: true, stock: 1 };
      prisma.reward.findMany
        .mockResolvedValueOnce([mockReward]) // user-1: in stock
        .mockResolvedValueOnce([]); // user-2: nothing left
      prisma.reward.findFirst.mockResolvedValue(null);

      const mockTx = {
        reward: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        pointTransaction: { create: vi.fn().mockResolvedValue({}) },
        rewardRedemption: {
          create: vi.fn().mockResolvedValue({ id: "redemption-1", status: "SHIPPED" }),
        },
        rewardPendingGrant: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
      };
      prisma.$transaction.mockImplementation((fn) => fn(mockTx));
      prisma.user.findUnique.mockResolvedValue({ email: "a@b.com", firstName: "A" });

      const result = await rewardService.fulfillPendingGrants();

      expect(result).toEqual({ checked: 2, fulfilled: 1 });
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

  describe("getRewardById", () => {
    it("returns the reward by id", async () => {
      prisma.reward.findUnique.mockResolvedValue({ id: "r1", name: "Coffee" });

      const result = await rewardService.getRewardById("r1");

      expect(result.name).toBe("Coffee");
      expect(prisma.reward.findUnique).toHaveBeenCalledWith({ where: { id: "r1" } });
    });
  });

  describe("createReward", () => {
    it("applies defaults for optional fields", async () => {
      prisma.reward.create.mockResolvedValue({ id: "r1" });

      await rewardService.createReward({ name: "Coffee", description: "A coffee" });

      expect(prisma.reward.create).toHaveBeenCalledWith({
        data: {
          name: "Coffee",
          description: "A coffee",
          pointsCost: 0,
          active: true,
          stock: 0,
          isMarketingItem: false,
        },
      });
    });

    it("respects explicitly provided values instead of defaults", async () => {
      prisma.reward.create.mockResolvedValue({ id: "r1" });

      await rewardService.createReward({
        name: "Shirt",
        description: "A shirt",
        pointsCost: 500,
        active: false,
        stock: 10,
        isMarketingItem: true,
      });

      expect(prisma.reward.create).toHaveBeenCalledWith({
        data: {
          name: "Shirt",
          description: "A shirt",
          pointsCost: 500,
          active: false,
          stock: 10,
          isMarketingItem: true,
        },
      });
    });
  });

  describe("updateReward", () => {
    it("throws if the reward does not exist", async () => {
      prisma.reward.findUnique.mockResolvedValue(null);

      await expect(rewardService.updateReward("ghost", { stock: 5 })).rejects.toThrow(
        "Reward not found"
      );
    });

    it("updates the reward without triggering a restock fulfillment when stock did not increase", async () => {
      prisma.reward.findUnique.mockResolvedValue({ id: "r1", stock: 5 });
      prisma.reward.update.mockResolvedValue({ id: "r1", stock: 5, active: false });

      await rewardService.updateReward("r1", { active: false });

      expect(prisma.reward.update).toHaveBeenCalled();
      // No stock number was provided, so the restock branch must not fire.
      expect(prisma.rewardPendingGrant.findMany).not.toHaveBeenCalled();
    });

    it("triggers a best-effort fulfillPendingGrants pass when stock increased", async () => {
      prisma.reward.findUnique.mockResolvedValue({ id: "r1", stock: 0 });
      prisma.reward.update.mockResolvedValue({ id: "r1", stock: 10 });
      prisma.rewardPendingGrant.findMany.mockResolvedValue([]);

      await rewardService.updateReward("r1", { stock: 10 });
      // fulfillPendingGrants runs fire-and-forget; give its microtask a tick
      await new Promise((r) => setImmediate(r));

      expect(prisma.rewardPendingGrant.findMany).toHaveBeenCalled();
    });

    it("does not trigger fulfillment when the new stock is lower or equal", async () => {
      prisma.reward.findUnique.mockResolvedValue({ id: "r1", stock: 10 });
      prisma.reward.update.mockResolvedValue({ id: "r1", stock: 3 });

      await rewardService.updateReward("r1", { stock: 3 });
      await new Promise((r) => setImmediate(r));

      expect(prisma.rewardPendingGrant.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getAllRedemptions", () => {
    it("lists every redemption across all users with reward + user info", async () => {
      prisma.rewardRedemption.findMany.mockResolvedValue([{ id: "red-1" }]);

      const result = await rewardService.getAllRedemptions();

      expect(result).toEqual([{ id: "red-1" }]);
      expect(prisma.rewardRedemption.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ reward: true, user: expect.any(Object) }),
          orderBy: { createdAt: "desc" },
        })
      );
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
