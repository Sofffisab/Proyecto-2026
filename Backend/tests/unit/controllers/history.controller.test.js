import { describe, it, expect, beforeEach, vi } from "vitest";
import * as historyController from "../../../src/controllers/history.controller.js";
import * as historyService from "../../../src/services/history.service.js";

vi.mock("../../../src/services/history.service.js");

describe("HistoryController", () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { id: "user-1", role: "USER" }, params: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("getInteractionHistory returns the caller's interaction history", async () => {
    const history = [{ type: "TRAINER_ASSISTANCE" }];
    historyService.getInteractionHistory.mockResolvedValue(history);

    await historyController.getInteractionHistory(req, res, next);

    expect(historyService.getInteractionHistory).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: history });
  });

  it("getDailyMachineUsageLog returns the caller's daily usage log", async () => {
    const log = [{ date: "2026-01-01", machinesUsed: 2 }];
    historyService.getDailyMachineUsageLog.mockResolvedValue(log);

    await historyController.getDailyMachineUsageLog(req, res, next);

    expect(historyService.getDailyMachineUsageLog).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: log });
  });

  it("getTrainerAssistanceHistory scopes the query to the calling trainer's own id", async () => {
    req.user = { id: "trainer-1", role: "TRAINER" };
    const history = [{ studentName: "John Doe" }];
    historyService.getTrainerAssistanceHistory.mockResolvedValue(history);

    await historyController.getTrainerAssistanceHistory(req, res, next);

    expect(historyService.getTrainerAssistanceHistory).toHaveBeenCalledWith("trainer-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: history });
  });

  it("forwards service errors to next()", async () => {
    const error = new Error("boom");
    historyService.getInteractionHistory.mockRejectedValue(error);

    await historyController.getInteractionHistory(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
