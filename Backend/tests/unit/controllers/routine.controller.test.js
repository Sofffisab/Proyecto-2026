import { describe, it, expect, vi, beforeEach } from "vitest";
import * as routineController from "../../../src/controllers/routine.controller.js";
import * as routineService from "../../../src/services/routine.service.js";

vi.mock("../../../src/services/routine.service.js");

describe("RoutineController", () => {
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

  describe("create", () => {
    it("returns 201 with the created routine", async () => {
      req.validatedData = { name: "Push day" };
      const mockRoutine = { id: "routine-1", name: "Push day" };
      vi.spyOn(routineService, "createRoutine").mockResolvedValue(mockRoutine);

      await routineController.create(req, res, next);

      expect(routineService.createRoutine).toHaveBeenCalledWith("user-123", { name: "Push day" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRoutine });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Invalid routine data");
      vi.spyOn(routineService, "createRoutine").mockRejectedValue(error);

      await routineController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getAll", () => {
    it("returns the user's routines", async () => {
      const mockRoutines = [{ id: "routine-1", name: "Push day" }];
      vi.spyOn(routineService, "getRoutines").mockResolvedValue(mockRoutines);

      await routineController.getAll(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRoutines });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(routineService, "getRoutines").mockRejectedValue(error);

      await routineController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getById", () => {
    it("returns the routine when found", async () => {
      req.params = { id: "routine-1" };
      const mockRoutine = { id: "routine-1", name: "Push day" };
      vi.spyOn(routineService, "getRoutineById").mockResolvedValue(mockRoutine);

      await routineController.getById(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRoutine });
    });

    it("returns 404 when the routine doesn't exist", async () => {
      req.params = { id: "nonexistent" };
      vi.spyOn(routineService, "getRoutineById").mockResolvedValue(null);

      await routineController.getById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Routine not found" });
    });

    it("calls next(err) if the service throws", async () => {
      req.params = { id: "routine-1" };
      const error = new Error("Database error");
      vi.spyOn(routineService, "getRoutineById").mockRejectedValue(error);

      await routineController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("update", () => {
    it("updates the routine", async () => {
      req.params = { id: "routine-1" };
      req.validatedData = { name: "Pull day" };
      const mockRoutine = { id: "routine-1", name: "Pull day" };
      vi.spyOn(routineService, "updateRoutine").mockResolvedValue(mockRoutine);

      await routineController.update(req, res, next);

      expect(routineService.updateRoutine).toHaveBeenCalledWith("routine-1", "user-123", {
        name: "Pull day",
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRoutine });
    });

    it("calls next(err) if the routine doesn't belong to the user", async () => {
      req.params = { id: "routine-1" };
      const error = new Error("Routine not found");
      vi.spyOn(routineService, "updateRoutine").mockRejectedValue(error);

      await routineController.update(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("remove", () => {
    it("deletes the routine", async () => {
      req.params = { id: "routine-1" };
      vi.spyOn(routineService, "deleteRoutine").mockResolvedValue(undefined);

      await routineController.remove(req, res, next);

      expect(routineService.deleteRoutine).toHaveBeenCalledWith("routine-1", "user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { deleted: true } });
    });

    it("calls next(err) if the routine doesn't belong to the user", async () => {
      req.params = { id: "routine-1" };
      const error = new Error("Routine not found");
      vi.spyOn(routineService, "deleteRoutine").mockRejectedValue(error);

      await routineController.remove(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("requestRoutine", () => {
    it("creates a routine request with a specific trainer", async () => {
      req.validatedData = { trainerId: "trainer-1" };
      const mockRequest = { id: "request-1", trainerId: "trainer-1" };
      vi.spyOn(routineService, "createRoutineRequest").mockResolvedValue(mockRequest);

      await routineController.requestRoutine(req, res, next);

      expect(routineService.createRoutineRequest).toHaveBeenCalledWith("user-123", "trainer-1");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRequest });
    });

    it("defaults trainerId to null when not provided", async () => {
      req.validatedData = undefined;
      const mockRequest = { id: "request-1", trainerId: null };
      vi.spyOn(routineService, "createRoutineRequest").mockResolvedValue(mockRequest);

      await routineController.requestRoutine(req, res, next);

      expect(routineService.createRoutineRequest).toHaveBeenCalledWith("user-123", null);
    });

    it("calls next(err) if the service throws", async () => {
      req.validatedData = { trainerId: "trainer-1" };
      const error = new Error("Trainer not available");
      vi.spyOn(routineService, "createRoutineRequest").mockRejectedValue(error);

      await routineController.requestRoutine(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getRequests", () => {
    it("passes the user's role along with their id", async () => {
      req.user = { id: "trainer-1", role: "TRAINER" };
      const mockRequests = [{ id: "request-1" }];
      vi.spyOn(routineService, "getRoutineRequests").mockResolvedValue(mockRequests);

      await routineController.getRequests(req, res, next);

      expect(routineService.getRoutineRequests).toHaveBeenCalledWith("trainer-1", "TRAINER");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockRequests });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(routineService, "getRoutineRequests").mockRejectedValue(error);

      await routineController.getRequests(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("acceptRequest", () => {
    it("accepts the routine request", async () => {
      req.params = { id: "request-1" };
      const mockResult = { id: "request-1", status: "ACCEPTED" };
      vi.spyOn(routineService, "acceptRoutineRequest").mockResolvedValue(mockResult);

      await routineController.acceptRequest(req, res, next);

      expect(routineService.acceptRoutineRequest).toHaveBeenCalledWith("request-1", "user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) if the service throws", async () => {
      req.params = { id: "request-1" };
      const error = new Error("Request not found");
      vi.spyOn(routineService, "acceptRoutineRequest").mockRejectedValue(error);

      await routineController.acceptRequest(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("rejectRequest", () => {
    it("rejects the routine request", async () => {
      req.params = { id: "request-1" };
      const mockResult = { id: "request-1", status: "REJECTED" };
      vi.spyOn(routineService, "rejectRoutineRequest").mockResolvedValue(mockResult);

      await routineController.rejectRequest(req, res, next);

      expect(routineService.rejectRoutineRequest).toHaveBeenCalledWith("request-1", "user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) if the service throws", async () => {
      req.params = { id: "request-1" };
      const error = new Error("Request not found");
      vi.spyOn(routineService, "rejectRoutineRequest").mockRejectedValue(error);

      await routineController.rejectRequest(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("completeRequest", () => {
    it("completes the routine request", async () => {
      req.params = { id: "request-1" };
      const mockResult = { id: "request-1", status: "COMPLETED" };
      vi.spyOn(routineService, "completeRoutineRequest").mockResolvedValue(mockResult);

      await routineController.completeRequest(req, res, next);

      expect(routineService.completeRoutineRequest).toHaveBeenCalledWith(
        "request-1",
        "user-123"
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) if the service throws", async () => {
      req.params = { id: "request-1" };
      const error = new Error("Request not found");
      vi.spyOn(routineService, "completeRoutineRequest").mockRejectedValue(error);

      await routineController.completeRequest(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("completeDay", () => {
    it("parses dayIndex from params and completes the day", async () => {
      req.params = { id: "routine-1", dayIndex: "2" };
      const mockResult = { id: "routine-1", completedDays: [2] };
      vi.spyOn(routineService, "completeDay").mockResolvedValue(mockResult);

      await routineController.completeDay(req, res, next);

      expect(routineService.completeDay).toHaveBeenCalledWith("routine-1", 2, "user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) if the day index is invalid", async () => {
      req.params = { id: "routine-1", dayIndex: "99" };
      const error = new Error("Invalid day index");
      vi.spyOn(routineService, "completeDay").mockRejectedValue(error);

      await routineController.completeDay(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getSuggestion", () => {
    it("returns a routine suggestion", async () => {
      const mockSuggestion = { exercises: ["Squat", "Bench Press"] };
      vi.spyOn(routineService, "getSuggestion").mockResolvedValue(mockSuggestion);

      await routineController.getSuggestion(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSuggestion });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(routineService, "getSuggestion").mockRejectedValue(error);

      await routineController.getSuggestion(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getPatternSuggestion", () => {
    it("returns a pattern-based suggestion", async () => {
      const mockSuggestion = { pattern: "3-day split" };
      vi.spyOn(routineService, "getPatternSuggestion").mockResolvedValue(mockSuggestion);

      await routineController.getPatternSuggestion(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockSuggestion });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(routineService, "getPatternSuggestion").mockRejectedValue(error);

      await routineController.getPatternSuggestion(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("acceptPatternSuggestion", () => {
    it("returns 201 with the accepted suggestion, defaulting validatedData to {}", async () => {
      req.validatedData = undefined;
      const mockResult = { id: "routine-1" };
      vi.spyOn(routineService, "acceptPatternSuggestion").mockResolvedValue(mockResult);

      await routineController.acceptPatternSuggestion(req, res, next);

      expect(routineService.acceptPatternSuggestion).toHaveBeenCalledWith("user-123", {});
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("No pending suggestion");
      vi.spyOn(routineService, "acceptPatternSuggestion").mockRejectedValue(error);

      await routineController.acceptPatternSuggestion(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("rejectPatternSuggestion", () => {
    it("rejects the pending pattern suggestion", async () => {
      const mockResult = { rejected: true };
      vi.spyOn(routineService, "rejectPatternSuggestion").mockResolvedValue(mockResult);

      await routineController.rejectPatternSuggestion(req, res, next);

      expect(routineService.rejectPatternSuggestion).toHaveBeenCalledWith("user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("No pending suggestion");
      vi.spyOn(routineService, "rejectPatternSuggestion").mockRejectedValue(error);

      await routineController.rejectPatternSuggestion(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getToday", () => {
    it("returns today's routine options", async () => {
      const mockOptions = { routines: [] };
      vi.spyOn(routineService, "getTodayOptions").mockResolvedValue(mockOptions);

      await routineController.getToday(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockOptions });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(routineService, "getTodayOptions").mockRejectedValue(error);

      await routineController.getToday(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
