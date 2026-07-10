import { describe, it, expect, vi, beforeEach } from "vitest";
import * as assistanceController from "../../../src/controllers/assistance.controller.js";
import * as assistanceService from "../../../src/services/assistance.service.js";

vi.mock("../../../src/services/assistance.service.js");

describe("AssistanceController", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: {},
      params: {},
      validatedData: {},
      user: { id: "user-123", role: "MEMBER" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  describe("request", () => {
    it("returns 201 with the created assistance request", async () => {
      const mockData = { id: "assist-1", userId: "user-123", status: "PENDING" };
      vi.spyOn(assistanceService, "requestAssistance").mockResolvedValue(mockData);

      await assistanceController.request(req, res, next);

      expect(assistanceService.requestAssistance).toHaveBeenCalledWith("user-123");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("User already has a pending request");
      vi.spyOn(assistanceService, "requestAssistance").mockRejectedValue(error);

      await assistanceController.request(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("assign", () => {
    it("assigns a trainer to an assistance request", async () => {
      req.params = { id: "assist-1" };
      req.validatedData = { trainerId: "trainer-1" };
      const mockData = { id: "assist-1", trainerId: "trainer-1", status: "ASSIGNED" };
      vi.spyOn(assistanceService, "assignAssistance").mockResolvedValue(mockData);

      await assistanceController.assign(req, res, next);

      expect(assistanceService.assignAssistance).toHaveBeenCalledWith("assist-1", "trainer-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the request no longer exists", async () => {
      req.params = { id: "assist-1" };
      req.validatedData = { trainerId: "trainer-1" };
      const error = new Error("Assistance request not found");
      vi.spyOn(assistanceService, "assignAssistance").mockRejectedValue(error);

      await assistanceController.assign(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("complete", () => {
    it("passes callerId and callerRole so the service can enforce ownership", async () => {
      req.params = { id: "assist-1" };
      req.user = { id: "trainer-1", role: "TRAINER" };
      const mockData = { id: "assist-1", status: "COMPLETED" };
      vi.spyOn(assistanceService, "completeAssistance").mockResolvedValue(mockData);

      await assistanceController.complete(req, res, next);

      expect(assistanceService.completeAssistance).toHaveBeenCalledWith(
        "assist-1",
        "trainer-1",
        "TRAINER"
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if a non-owner trainer tries to complete it", async () => {
      req.params = { id: "assist-1" };
      req.user = { id: "trainer-2", role: "TRAINER" };
      const error = new Error("Only the assigned trainer can complete this request");
      vi.spyOn(assistanceService, "completeAssistance").mockRejectedValue(error);

      await assistanceController.complete(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("cancel", () => {
    it("cancels the assistance request", async () => {
      req.params = { id: "assist-1" };
      const mockData = { id: "assist-1", status: "CANCELLED" };
      vi.spyOn(assistanceService, "cancelAssistance").mockResolvedValue(mockData);

      await assistanceController.cancel(req, res, next);

      expect(assistanceService.cancelAssistance).toHaveBeenCalledWith("assist-1", "user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the service throws", async () => {
      req.params = { id: "assist-1" };
      const error = new Error("Cannot cancel a completed request");
      vi.spyOn(assistanceService, "cancelAssistance").mockRejectedValue(error);

      await assistanceController.cancel(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("setAvailability", () => {
    it("sets the trainer's availability", async () => {
      req.body = { availability: true };
      const mockData = { id: "trainer-1", availability: true };
      vi.spyOn(assistanceService, "setTrainerAvailability").mockResolvedValue(mockData);

      await assistanceController.setAvailability(req, res, next);

      expect(assistanceService.setTrainerAvailability).toHaveBeenCalledWith("user-123", true);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the service throws", async () => {
      req.body = { availability: false };
      const error = new Error("Trainer profile not found");
      vi.spyOn(assistanceService, "setTrainerAvailability").mockRejectedValue(error);

      await assistanceController.setAvailability(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getPending", () => {
    it("returns the list of pending assistance requests", async () => {
      const mockData = [{ id: "assist-1", status: "PENDING" }];
      vi.spyOn(assistanceService, "getPendingAssistance").mockResolvedValue(mockData);

      await assistanceController.getPending(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(assistanceService, "getPendingAssistance").mockRejectedValue(error);

      await assistanceController.getPending(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getHistory", () => {
    it("returns the user's assistance history", async () => {
      const mockData = [{ id: "assist-1", status: "COMPLETED" }];
      vi.spyOn(assistanceService, "getAssistanceHistory").mockResolvedValue(mockData);

      await assistanceController.getHistory(req, res, next);

      expect(assistanceService.getAssistanceHistory).toHaveBeenCalledWith("user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(assistanceService, "getAssistanceHistory").mockRejectedValue(error);

      await assistanceController.getHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
