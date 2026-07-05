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
      { id: "redemption-1", userId: "user-1", rewardId: "reward-1", status: "PENDING" },
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

  it("updateRedemptionStatus with status APPROVED calls approveReward", async () => {
    req.params = { id: "redemption-1" };
    req.body = { status: "APPROVED" };
    req.user = { id: "admin-1", role: "ADMIN" };

    const mockUpdated = { id: "redemption-1", status: "APPROVED" };
    vi.spyOn(rewardService, "approveReward").mockResolvedValue(mockUpdated);

    await rewardController.updateRedemptionStatus(req, res, next);

    expect(rewardService.approveReward).toHaveBeenCalledWith("redemption-1", "admin-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
  });
});
