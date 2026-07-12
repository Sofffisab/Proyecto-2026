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

  it("updateRedemptionStatus calls next(err) on failure", async () => {
    req.params = { id: "redemption-1" };
    req.body = { status: "DELIVERED" };
    const error = new Error("boom");
    vi.spyOn(rewardService, "deliverReward").mockRejectedValue(error);

    await rewardController.updateRedemptionStatus(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("getAvailableRewards calls next(err) on failure", async () => {
    const error = new Error("boom");
    vi.spyOn(rewardService, "getAvailableRewards").mockRejectedValue(error);

    await rewardController.getAvailableRewards(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it("getUserRedemptions calls next(err) on failure", async () => {
    const error = new Error("boom");
    vi.spyOn(rewardService, "getUserRedemptions").mockRejectedValue(error);

    await rewardController.getUserRedemptions(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  describe("getRewardById", () => {
    it("returns the reward when found", async () => {
      req.params.id = "reward-1";
      const mockReward = { id: "reward-1", name: "T-Shirt" };
      vi.spyOn(rewardService, "getRewardById").mockResolvedValue(mockReward);

      await rewardController.getRewardById(req, res, next);

      expect(rewardService.getRewardById).toHaveBeenCalledWith("reward-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockReward });
    });

    it("returns 404 when the reward is not found", async () => {
      req.params.id = "missing";
      vi.spyOn(rewardService, "getRewardById").mockResolvedValue(null);

      await rewardController.getRewardById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Reward not found" });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(rewardService, "getRewardById").mockRejectedValue(error);

      await rewardController.getRewardById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getAllRewardsAdmin", () => {
    it("returns the full admin catalog", async () => {
      const mockRewards = [{ id: "r1", stock: 5 }];
      vi.spyOn(rewardService, "getAllRewardsAdmin").mockResolvedValue(mockRewards);

      await rewardController.getAllRewardsAdmin(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRewards });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(rewardService, "getAllRewardsAdmin").mockRejectedValue(error);

      await rewardController.getAllRewardsAdmin(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createReward", () => {
    it("creates the reward and responds with 201", async () => {
      req.validatedData = { name: "Cap", pointsCost: 50 };
      const mockReward = { id: "r1", name: "Cap", pointsCost: 50 };
      vi.spyOn(rewardService, "createReward").mockResolvedValue(mockReward);

      await rewardController.createReward(req, res, next);

      expect(rewardService.createReward).toHaveBeenCalledWith(req.validatedData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockReward });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(rewardService, "createReward").mockRejectedValue(error);

      await rewardController.createReward(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateReward", () => {
    it("updates the reward", async () => {
      req.params.id = "r1";
      req.validatedData = { name: "New Name" };
      const mockReward = { id: "r1", name: "New Name" };
      vi.spyOn(rewardService, "updateReward").mockResolvedValue(mockReward);

      await rewardController.updateReward(req, res, next);

      expect(rewardService.updateReward).toHaveBeenCalledWith("r1", req.validatedData);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockReward });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(rewardService, "updateReward").mockRejectedValue(error);

      await rewardController.updateReward(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deliver", () => {
    it("marks the reward as delivered", async () => {
      req.params.id = "redemption-1";
      const mockUpdated = { id: "redemption-1", status: "DELIVERED" };
      vi.spyOn(rewardService, "deliverReward").mockResolvedValue(mockUpdated);

      await rewardController.deliver(req, res, next);

      expect(rewardService.deliverReward).toHaveBeenCalledWith("redemption-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(rewardService, "deliverReward").mockRejectedValue(error);

      await rewardController.deliver(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getAllRedemptions", () => {
    it("returns every redemption", async () => {
      const mockList = [{ id: "red-1" }, { id: "red-2" }];
      vi.spyOn(rewardService, "getAllRedemptions").mockResolvedValue(mockList);

      await rewardController.getAllRedemptions(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockList });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(rewardService, "getAllRedemptions").mockRejectedValue(error);

      await rewardController.getAllRedemptions(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getPendingGrants", () => {
    it("returns the pending shipment queue", async () => {
      const mockList = [{ id: "grant-1" }];
      vi.spyOn(rewardService, "getPendingGrants").mockResolvedValue(mockList);

      await rewardController.getPendingGrants(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockList });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      vi.spyOn(rewardService, "getPendingGrants").mockRejectedValue(error);

      await rewardController.getPendingGrants(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
