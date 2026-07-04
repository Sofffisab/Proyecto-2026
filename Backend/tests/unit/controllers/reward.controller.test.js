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

  it("getAvailableRewards retorna 200 con lista de recompensas", async () => {
    const mockRewards = [
      { id: "reward-1", name: "T-Shirt", pointsCost: 100 },
      { id: "reward-2", name: "Gym Bag", pointsCost: 250 },
    ];

    vi.spyOn(rewardService, "getAvailableRewards").mockResolvedValue(mockRewards);

    await rewardController.getAvailableRewards(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRewards });
  });

  it("redeemReward rechaza si no hay puntos suficientes", async () => {
    req.params = { id: "reward-1" };

    vi.spyOn(rewardService, "generateReward").mockRejectedValue(
      new Error("Not enough points. Required: 100, available: 50")
    );

    await rewardController.redeemReward(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("redeemReward retorna 201 y crea redemption", async () => {
    req.params = { id: "reward-1" };

    const mockRedemption = {
      id: "redemption-1",
      userId: "user-1",
      rewardId: "reward-1",
      status: "PENDING",
    };

    vi.spyOn(rewardService, "generateReward").mockResolvedValue(mockRedemption);

    await rewardController.redeemReward(req, res, next);

    expect(rewardService.generateReward).toHaveBeenCalledWith("user-1", "reward-1");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRedemption });
  });

  it("updateRedemptionStatus rechaza un status desconocido con 400", async () => {
    req.params = { id: "redemption-1" };
    req.body = { status: "NOT_A_REAL_STATUS" };

    await rewardController.updateRedemptionStatus(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("updateRedemptionStatus con status APPROVED llama a approveReward", async () => {
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
