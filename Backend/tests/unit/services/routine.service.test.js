import { describe, it, expect, vi, beforeEach } from "vitest";
import * as routineService from "../../../src/services/routine.service.js";
import prisma from "../../../src/config/prisma.js";

describe("RoutineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRoutine", () => {
    it("creates a routine for the user", async () => {
      const mockRoutine = { id: "routine-1", userId: "user-1", name: "Push day" };
      prisma.routine.create.mockResolvedValue(mockRoutine);

      const result = await routineService.createRoutine("user-1", {
        name: "Push day",
        content: {},
      });

      expect(prisma.routine.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "user-1" }) })
      );
      expect(result).toEqual(mockRoutine);
    });
  });

  describe("getRoutineById", () => {
    it("throws 404 if the routine does not exist", async () => {
      prisma.routine.findUnique.mockResolvedValue(null);

      await expect(routineService.getRoutineById("routine-1", "user-1")).rejects.toThrow(
        "Routine not found"
      );
    });

    it("throws 403 if the routine belongs to another user", async () => {
      prisma.routine.findUnique.mockResolvedValue({ id: "routine-1", userId: "someone-else" });

      await expect(routineService.getRoutineById("routine-1", "user-1")).rejects.toThrow(
        "Forbidden"
      );
    });

    it("returns the routine if it belongs to the caller", async () => {
      const mockRoutine = { id: "routine-1", userId: "user-1" };
      prisma.routine.findUnique.mockResolvedValue(mockRoutine);

      const result = await routineService.getRoutineById("routine-1", "user-1");
      expect(result).toEqual(mockRoutine);
    });
  });

  describe("completeDay", () => {
    it("awards points and returns success", async () => {
      prisma.routine.findUnique.mockResolvedValue({ id: "routine-1", userId: "user-1" });
      prisma.pointTransaction.create.mockResolvedValue({});

      const result = await routineService.completeDay("routine-1", 2, "user-1");

      expect(result.success).toBe(true);
      expect(prisma.pointTransaction.create).toHaveBeenCalled();
    });

    it("throws Forbidden if the routine belongs to another user", async () => {
      prisma.routine.findUnique.mockResolvedValue({ id: "routine-1", userId: "other-user" });

      await expect(routineService.completeDay("routine-1", 1, "user-1")).rejects.toThrow(
        "Forbidden"
      );
    });
  });

  describe("getSuggestion", () => {
    it("returns a GENERAL suggestion if the user has no active goals", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.goal.findMany.mockResolvedValue([]);

      const result = await routineService.getSuggestion("user-1");

      expect(result.target).toBe("GENERAL");
    });

    it("throws 404 if the user does not exist", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(routineService.getSuggestion("ghost-user")).rejects.toThrow("User not found");
    });

    it("prioritizes the goal with no progress logged yet", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.goal.findMany.mockResolvedValue([
        { id: "goal-1", type: "WEIGHT_LOSS", progress: [{ progressPercent: 80, createdAt: new Date() }] },
        { id: "goal-2", type: "MUSCLE_GAIN", progress: [] },
      ]);

      const result = await routineService.getSuggestion("user-1");
      expect(result.goalId).toBe("goal-2");
    });
  });

  describe("createRoutineRequest", () => {
    it("rejects if the chosen trainer is not actually a TRAINER", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "trainer-1", role: "USER" });

      await expect(
        routineService.createRoutineRequest("user-1", "trainer-1")
      ).rejects.toThrow("Invalid trainer selection");
    });

    it("creates a PENDING request with no specific trainer", async () => {
      prisma.routineRequest.create.mockResolvedValue({ id: "req-1", status: "PENDING" });

      const result = await routineService.createRoutineRequest("user-1", null);
      expect(result.status).toBe("PENDING");
    });
  });

  describe("acceptRoutineRequest / rejectRoutineRequest", () => {
    it("throws if the request is not pending", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({ id: "req-1", status: "ACCEPTED" });

      await expect(
        routineService.acceptRoutineRequest("req-1", "trainer-1")
      ).rejects.toThrow("Request is not pending");
    });

    it("only the assigned trainer can reject an already-assigned request", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({
        id: "req-1",
        status: "PENDING",
        trainerId: "trainer-1",
      });

      await expect(
        routineService.rejectRoutineRequest("req-1", "trainer-2")
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("getPatternSuggestion", () => {
    it("returns available:false when there is no training history", async () => {
      prisma.userBehaviorProfile.findUnique.mockResolvedValue({
        routines: [],
        topMachines: [],
        frequentDays: [],
      });

      const result = await routineService.getPatternSuggestion("user-1");
      expect(result.available).toBe(false);
    });
  });
});
