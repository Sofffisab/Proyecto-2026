import { describe, it, expect, vi, beforeEach } from "vitest";
import * as machineConflictController from "../../../src/controllers/machineConflict.controller.js";
import * as machineConflictService from "../../../src/services/machineConflict.service.js";

vi.mock("../../../src/services/machineConflict.service.js");

describe("MachineConflictController", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: {},
      params: {},
      validatedData: {},
      user: { id: "trainer-1", role: "TRAINER" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  describe("getPendingConflicts", () => {
    it("returns the list of unresolved conflicts", async () => {
      const mockConflicts = [
        { id: "conflict-1", machineId: "machine-1", resolvedAt: null },
      ];
      vi.spyOn(machineConflictService, "getPendingConflicts").mockResolvedValue(mockConflicts);

      await machineConflictController.getPendingConflicts(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockConflicts });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(machineConflictService, "getPendingConflicts").mockRejectedValue(error);

      await machineConflictController.getPendingConflicts(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("resolveConflict", () => {
    it("resolves the conflict with the trainer's resolution", async () => {
      req.params = { id: "conflict-1" };
      req.validatedData = { resolution: "BOTH_PRESENT" };
      const mockResult = { id: "conflict-1", resolvedAt: new Date(), resolution: "BOTH_PRESENT" };
      vi.spyOn(machineConflictService, "resolveConflict").mockResolvedValue(mockResult);

      await machineConflictController.resolveConflict(req, res, next);

      expect(machineConflictService.resolveConflict).toHaveBeenCalledWith(
        "conflict-1",
        "trainer-1",
        "BOTH_PRESENT"
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) if the conflict was already resolved", async () => {
      req.params = { id: "conflict-1" };
      req.validatedData = { resolution: "NEITHER_PRESENT" };
      const error = new Error("This conflict was already resolved");
      vi.spyOn(machineConflictService, "resolveConflict").mockRejectedValue(error);

      await machineConflictController.resolveConflict(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it("calls next(err) if the conflict does not exist", async () => {
      req.params = { id: "nonexistent" };
      req.validatedData = { resolution: "ONLY_FIRST" };
      const error = new Error("Machine conflict not found");
      vi.spyOn(machineConflictService, "resolveConflict").mockRejectedValue(error);

      await machineConflictController.resolveConflict(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
