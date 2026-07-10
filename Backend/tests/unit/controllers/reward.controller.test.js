import { describe, it, expect, beforeEach, vi } from "vitest";
import * as rewardController from "../../../src/controllers/reward.controller.js";
import * as rewardService from "../../../src/services/reward.service.js";

vi.mock("../../../src/services/reward.service.js");

describe("RewardController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: "user-1", role: "USER" },
      params: {},
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("getAvailableRewards returns 200 with the list of rewards", async () => {
    const mockRewards = [
      { id: "reward-1", name: "T-Shirt", pointsCost: 100 },
      { id: "reward-2", name: "Gym Bag", pointsCost: 250 },
    ];

    vi.spyOn(rewardService, "getAvailableRewards").mockResolvedValue(mockRewards);

    await rewardController.getAvailableRewards(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRewards });
  });

  it("getUserRedemptions returns 200 with the user redemptions", async () => {
    const mockRedemptions = [
      { id: "redemption-1", userId: "user-1", rewardId: "reward-1", status: "SHIPPED" },
    ];
    vi.spyOn(rewardService, "getUserRedemptions").mockResolvedValue(mockRedemptions);
    await rewardController.getUserRedemptions(req, res, next);
    expect(rewardService.getUserRedemptions).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRedemptions });
  });

  it("updateRedemptionStatus rejects an unknown status with 400", async () => {
    req.params = { id: "redemption-1" };
    req.body = { status: "NOT_A_REAL_STATUS" };

    await rewardController.updateRedemptionStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("updateRedemptionStatus with status DELIVERED calls deliverReward", async () => {
    req.params = { id: "redemption-1" };
    req.body = { status: "DELIVERED" };
    req.user = { id: "admin-1", role: "ADMIN" };

    const mockUpdated = { id: "redemption-1", status: "DELIVERED" };
    vi.spyOn(rewardService, "deliverReward").mockResolvedValue(mockUpdated);

    await rewardController.updateRedemptionStatus(req, res, next);

    expect(rewardService.deliverReward).toHaveBeenCalledWith("redemption-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
  });

  describe("getRewardById", () => {
    it("returns 200 with the reward when found", async () => {
      req.params = { id: "reward-1" };
      const mockReward = { id: "reward-1", name: "T-Shirt" };
      vi.spyOn(rewardService, "getRewardById").mockResolvedValue(mockReward);

      await rewardController.getRewardById(req, res, next);

      expect(rewardService.getRewardById).toHaveBeenCalledWith("reward-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockReward });
    });

    it("returns 404 when the reward does not exist", async () => {
      req.params = { id: "does-not-exist" };
      vi.spyOn(rewardService, "getRewardById").mockResolvedValue(null);

      await rewardController.getRewardById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Reward not found" });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "reward-1" };
      const error = new Error("DB error");
      vi.spyOn(rewardService, "getRewardById").mockRejectedValue(error);

      await rewardController.getRewardById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getAllRewardsAdmin", () => {
    it("returns 200 with the full admin catalog (including stock)", async () => {
      const mockRewards = [{ id: "reward-1", stock: 5, isMarketingItem: false }];
      vi.spyOn(rewardService, "getAllRewardsAdmin").mockResolvedValue(mockRewards);

      await rewardController.getAllRewardsAdmin(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRewards });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(rewardService, "getAllRewardsAdmin").mockRejectedValue(error);

      await rewardController.getAllRewardsAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createReward", () => {
    it("creates a reward and returns 201", async () => {
      req.validatedData = { name: "Water Bottle", pointsCost: 50, stock: 10 };
      const mockReward = { id: "reward-3", ...req.validatedData };
      vi.spyOn(rewardService, "createReward").mockResolvedValue(mockReward);

      await rewardController.createReward(req, res, next);

      expect(rewardService.createReward).toHaveBeenCalledWith(req.validatedData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockReward });
    });

    it("calls next(err) on failure", async () => {
      req.validatedData = { name: "Water Bottle" };
      const error = new Error("Validation error");
      vi.spyOn(rewardService, "createReward").mockRejectedValue(error);

      await rewardController.createReward(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateReward", () => {
    it("updates a reward and returns 200", async () => {
      req.params = { id: "reward-1" };
      req.validatedData = { stock: 20 };
      const mockUpdated = { id: "reward-1", stock: 20 };
      vi.spyOn(rewardService, "updateReward").mockResolvedValue(mockUpdated);

      await rewardController.updateReward(req, res, next);

      expect(rewardService.updateReward).toHaveBeenCalledWith("reward-1", req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "reward-1" };
      req.validatedData = { stock: 20 };
      const error = new Error("DB error");
      vi.spyOn(rewardService, "updateReward").mockRejectedValue(error);

      await rewardController.updateReward(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deliver", () => {
    it("marks a reward as delivered and returns 200", async () => {
      req.params = { id: "redemption-1" };
      const mockDelivered = { id: "redemption-1", status: "DELIVERED" };
      vi.spyOn(rewardService, "deliverReward").mockResolvedValue(mockDelivered);

      await rewardController.deliver(req, res, next);

      expect(rewardService.deliverReward).toHaveBeenCalledWith("redemption-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockDelivered });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "redemption-1" };
      const error = new Error("Already delivered");
      vi.spyOn(rewardService, "deliverReward").mockRejectedValue(error);

      await rewardController.deliver(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getAllRedemptions", () => {
    it("returns 200 with every redemption (admin view)", async () => {
      const mockRedemptions = [{ id: "redemption-1" }, { id: "redemption-2" }];
      vi.spyOn(rewardService, "getAllRedemptions").mockResolvedValue(mockRedemptions);

      await rewardController.getAllRedemptions(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRedemptions });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(rewardService, "getAllRedemptions").mockRejectedValue(error);

      await rewardController.getAllRedemptions(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getPendingGrants", () => {
    it("returns 200 with users waiting for restock", async () => {
      const mockPending = [{ userId: "user-1", rewardId: "reward-1" }];
      vi.spyOn(rewardService, "getPendingGrants").mockResolvedValue(mockPending);

      await rewardController.getPendingGrants(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockPending });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      vi.spyOn(rewardService, "getPendingGrants").mockRejectedValue(error);

      await rewardController.getPendingGrants(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
