import { describe, it, expect, vi, beforeEach } from "vitest";
import * as progressController from "../../../src/controllers/progress.controller.js";
import * as progressService from "../../../src/services/progress.service.js";

vi.mock("../../../src/services/progress.service.js");

describe("ProgressController", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: {},
      params: {},
      validatedData: {},
      user: { id: "user-123" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  describe("addProgressLog", () => {
    it("returns 201 with the created progress log", async () => {
      req.validatedData = { goalId: "goal-1", value: 10 };
      const mockData = { id: "progress-1", goalId: "goal-1", value: 10 };
      vi.spyOn(progressService, "addProgress").mockResolvedValue(mockData);

      await progressController.addProgressLog(req, res, next);

      expect(progressService.addProgress).toHaveBeenCalledWith("user-123", "goal-1", 10);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the goal doesn't belong to the user", async () => {
      req.validatedData = { goalId: "goal-1", value: 10 };
      const error = new Error("Goal not found");
      vi.spyOn(progressService, "addProgress").mockRejectedValue(error);

      await progressController.addProgressLog(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getProgressHistory", () => {
    it("returns the user's progress history", async () => {
      const mockData = [{ id: "progress-1", value: 10 }];
      vi.spyOn(progressService, "getProgressHistory").mockResolvedValue(mockData);

      await progressController.getProgressHistory(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(progressService, "getProgressHistory").mockRejectedValue(error);

      await progressController.getProgressHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("updateProgressLog", () => {
    it("updates the progress entry", async () => {
      req.params = { id: "progress-1" };
      req.validatedData = { value: 20 };
      const mockData = { id: "progress-1", value: 20 };
      vi.spyOn(progressService, "updateProgressEntry").mockResolvedValue(mockData);

      await progressController.updateProgressLog(req, res, next);

      expect(progressService.updateProgressEntry).toHaveBeenCalledWith(
        "progress-1",
        "user-123",
        { value: 20 }
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) if the entry doesn't belong to the user", async () => {
      req.params = { id: "progress-1" };
      const error = new Error("Progress entry not found");
      vi.spyOn(progressService, "updateProgressEntry").mockRejectedValue(error);

      await progressController.updateProgressLog(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getProgressById", () => {
    it("returns the progress entry when found", async () => {
      req.params = { id: "progress-1" };
      const mockEntry = { id: "progress-1", value: 10 };
      vi.spyOn(progressService, "getProgressEntryById").mockResolvedValue(mockEntry);

      await progressController.getProgressById(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockEntry });
    });

    it("calls next(AppError 404) when the entry doesn't exist", async () => {
      req.params = { id: "nonexistent" };
      vi.spyOn(progressService, "getProgressEntryById").mockResolvedValue(null);

      await progressController.getProgressById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("deleteProgress", () => {
    it("deletes the progress entry", async () => {
      req.params = { id: "progress-1" };
      vi.spyOn(progressService, "deleteProgressEntry").mockResolvedValue(undefined);

      await progressController.deleteProgress(req, res, next);

      expect(progressService.deleteProgressEntry).toHaveBeenCalledWith("progress-1", "user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { deleted: true } });
    });

    it("calls next(err) if the entry doesn't belong to the user", async () => {
      req.params = { id: "progress-1" };
      const error = new Error("Progress entry not found");
      vi.spyOn(progressService, "deleteProgressEntry").mockRejectedValue(error);

      await progressController.deleteProgress(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getStats", () => {
    it("returns the user's progress stats", async () => {
      const mockStats = { totalLogs: 5, streak: 3 };
      vi.spyOn(progressService, "getProgressStats").mockResolvedValue(mockStats);

      await progressController.getStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockStats });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(progressService, "getProgressStats").mockRejectedValue(error);

      await progressController.getStats(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createGoal", () => {
    it("returns 201 with the created goal", async () => {
      req.validatedData = { title: "Run 5k" };
      const mockGoal = { id: "goal-1", title: "Run 5k" };
      vi.spyOn(progressService, "createGoal").mockResolvedValue(mockGoal);

      await progressController.createGoal(req, res, next);

      expect(progressService.createGoal).toHaveBeenCalledWith("user-123", { title: "Run 5k" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGoal });
    });

    it("calls next(err) if the service throws", async () => {
      req.validatedData = { title: "Run 5k" };
      const error = new Error("Invalid goal data");
      vi.spyOn(progressService, "createGoal").mockRejectedValue(error);

      await progressController.createGoal(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getGoals", () => {
    it("returns the user's goals", async () => {
      const mockGoals = [{ id: "goal-1", title: "Run 5k" }];
      vi.spyOn(progressService, "getGoals").mockResolvedValue(mockGoals);

      await progressController.getGoals(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGoals });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(progressService, "getGoals").mockRejectedValue(error);

      await progressController.getGoals(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getGoalById", () => {
    it("returns the goal when found", async () => {
      req.params = { id: "goal-1" };
      const mockGoal = { id: "goal-1", title: "Run 5k" };
      vi.spyOn(progressService, "getGoalById").mockResolvedValue(mockGoal);

      await progressController.getGoalById(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGoal });
    });

    it("calls next(AppError 404) when the goal doesn't exist", async () => {
      req.params = { id: "nonexistent" };
      vi.spyOn(progressService, "getGoalById").mockResolvedValue(null);

      await progressController.getGoalById(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("updateGoal", () => {
    it("updates the goal", async () => {
      req.params = { id: "goal-1" };
      req.validatedData = { title: "Run 10k" };
      const mockGoal = { id: "goal-1", title: "Run 10k" };
      vi.spyOn(progressService, "updateGoal").mockResolvedValue(mockGoal);

      await progressController.updateGoal(req, res, next);

      expect(progressService.updateGoal).toHaveBeenCalledWith("goal-1", "user-123", {
        title: "Run 10k",
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockGoal });
    });

    it("calls next(err) if the goal doesn't belong to the user", async () => {
      req.params = { id: "goal-1" };
      const error = new Error("Goal not found");
      vi.spyOn(progressService, "updateGoal").mockRejectedValue(error);

      await progressController.updateGoal(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deleteGoal", () => {
    it("deletes the goal", async () => {
      req.params = { id: "goal-1" };
      vi.spyOn(progressService, "deleteGoal").mockResolvedValue(undefined);

      await progressController.deleteGoal(req, res, next);

      expect(progressService.deleteGoal).toHaveBeenCalledWith("goal-1", "user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: { deleted: true } });
    });

    it("calls next(err) if the goal doesn't belong to the user", async () => {
      req.params = { id: "goal-1" };
      const error = new Error("Goal not found");
      vi.spyOn(progressService, "deleteGoal").mockRejectedValue(error);

      await progressController.deleteGoal(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
