import { describe, it, expect, beforeEach, vi } from "vitest";
import * as syncController from "../../../src/controllers/sync.controller.js";
import * as gymService from "../../../src/services/gym.service.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/services/gym.service.js");

describe("SyncController.syncOfflineActions", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: "user-1", role: "USER" },
      validatedData: { actions: [] },
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("processes a checkin action through gymService.checkIn", async () => {
    const timestamp = new Date().toISOString();
    req.validatedData.actions = [{ type: "checkin", timestamp }];
    gymService.checkIn.mockResolvedValue({ id: "session-1" });

    await syncController.syncOfflineActions(req, res, next);

    expect(gymService.checkIn).toHaveBeenCalledWith("user-1", {
      checkInAt: new Date(timestamp),
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      results: [{ type: "checkin", success: true, data: { id: "session-1" } }],
    });
  });

  it("processes a checkout action by closing the open session and computing duration", async () => {
    const checkInAt = new Date(Date.now() - 30 * 60 * 1000);
    const timestamp = new Date().toISOString();
    req.validatedData.actions = [{ type: "checkout", timestamp }];

    prisma.gymSession.findFirst.mockResolvedValue({ id: "session-1", checkInAt });
    prisma.gymSession.update.mockResolvedValue({ id: "session-1", checkOutAt: new Date(timestamp) });

    await syncController.syncOfflineActions(req, res, next);

    expect(prisma.gymSession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({ durationMinutes: expect.any(Number) }),
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, results: expect.any(Array) })
    );
    expect(res.json.mock.calls[0][0].results[0].success).toBe(true);
  });

  it("reports a checkout action as successful with null data when there is no open session", async () => {
    req.validatedData.actions = [{ type: "checkout", timestamp: new Date().toISOString() }];
    prisma.gymSession.findFirst.mockResolvedValue(null);

    await syncController.syncOfflineActions(req, res, next);

    expect(prisma.gymSession.update).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      results: [{ type: "checkout", success: true, data: null }],
    });
  });

  it("processes a machineStart action by creating a machine usage row", async () => {
    const timestamp = new Date().toISOString();
    req.validatedData.actions = [
      { type: "machineStart", timestamp, payload: { machineId: "machine-1", gymSessionId: "session-1" } },
    ];
    prisma.machineUsage.create.mockResolvedValue({ id: "usage-1" });

    await syncController.syncOfflineActions(req, res, next);

    expect(prisma.machineUsage.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        machineId: "machine-1",
        gymSessionId: "session-1",
        startedAt: new Date(timestamp),
      },
    });
  });

  it("processes a machineEnd action by closing the open usage and computing duration", async () => {
    const startedAt = new Date(Date.now() - 10 * 60 * 1000);
    const timestamp = new Date().toISOString();
    req.validatedData.actions = [
      { type: "machineEnd", timestamp, payload: { machineId: "machine-1" } },
    ];
    prisma.machineUsage.findFirst.mockResolvedValue({ id: "usage-1", startedAt });
    prisma.machineUsage.update.mockResolvedValue({ id: "usage-1", endedAt: new Date(timestamp) });

    await syncController.syncOfflineActions(req, res, next);

    expect(prisma.machineUsage.update).toHaveBeenCalledWith({
      where: { id: "usage-1" },
      data: expect.objectContaining({ durationMinutes: expect.any(Number) }),
    });
  });

  it("rejects an action with a timestamp more than 7 days in the past without aborting the batch", async () => {
    const staleTimestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const freshTimestamp = new Date().toISOString();
    req.validatedData.actions = [
      { type: "checkin", timestamp: staleTimestamp },
      { type: "checkin", timestamp: freshTimestamp },
    ];
    gymService.checkIn.mockResolvedValue({ id: "session-1" });

    await syncController.syncOfflineActions(req, res, next);

    const { results } = res.json.mock.calls[0][0];
    expect(results[0]).toEqual({
      type: "checkin",
      success: false,
      error: "Timestamp is too old (> 7 days)",
    });
    expect(results[1].success).toBe(true);
  });

  it("rejects an action with a future timestamp", async () => {
    const futureTimestamp = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    req.validatedData.actions = [{ type: "checkin", timestamp: futureTimestamp }];

    await syncController.syncOfflineActions(req, res, next);

    const { results } = res.json.mock.calls[0][0];
    expect(results[0]).toEqual({
      type: "checkin",
      success: false,
      error: "Timestamp is in the future",
    });
    expect(gymService.checkIn).not.toHaveBeenCalled();
  });

  it("rejects an action with an unparseable timestamp", async () => {
    req.validatedData.actions = [{ type: "checkin", timestamp: "not-a-date" }];

    await syncController.syncOfflineActions(req, res, next);

    const { results } = res.json.mock.calls[0][0];
    expect(results[0]).toEqual({
      type: "checkin",
      success: false,
      error: "Invalid timestamp",
    });
  });

  it("keeps processing remaining actions when one action throws", async () => {
    const timestamp = new Date().toISOString();
    req.validatedData.actions = [
      { type: "checkin", timestamp },
      { type: "checkin", timestamp },
    ];
    gymService.checkIn
      .mockRejectedValueOnce(new Error("db exploded"))
      .mockResolvedValueOnce({ id: "session-2" });

    await syncController.syncOfflineActions(req, res, next);

    const { results } = res.json.mock.calls[0][0];
    expect(results[0]).toEqual({ type: "checkin", success: false, error: "db exploded" });
    expect(results[1]).toEqual({
      type: "checkin",
      success: true,
      data: { id: "session-2" },
    });
  });

  it("forwards unexpected top-level errors to next()", async () => {
    req.validatedData = null; // destructuring `actions` from null throws synchronously

    await syncController.syncOfflineActions(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
