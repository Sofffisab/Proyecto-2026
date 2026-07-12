import { describe, it, expect, vi, beforeEach } from "vitest";
import * as routineService from "../../../src/services/routine.service.js";
import prisma from "../../../src/config/prisma.js";

describe("RoutineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRoutines", () => {
    it("returns the caller's routines ordered by newest first", async () => {
      prisma.routine.findMany.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);

      const result = await routineService.getRoutines("user-1");

      expect(prisma.routine.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("updateRoutine", () => {
    it("updates the routine when it belongs to the caller", async () => {
      prisma.routine.findUnique.mockResolvedValue({ id: "r1", userId: "user-1" });
      prisma.routine.update.mockResolvedValue({ id: "r1", name: "New name" });

      const result = await routineService.updateRoutine("r1", "user-1", { name: "New name" });

      expect(result.name).toBe("New name");
    });

    it("throws 404 if the routine does not exist", async () => {
      prisma.routine.findUnique.mockResolvedValue(null);

      await expect(routineService.updateRoutine("ghost", "user-1", {})).rejects.toThrow(
        "Routine not found"
      );
    });

    it("throws 403 if the routine belongs to another user", async () => {
      prisma.routine.findUnique.mockResolvedValue({ id: "r1", userId: "other-user" });

      await expect(routineService.updateRoutine("r1", "user-1", {})).rejects.toThrow("Forbidden");
    });
  });

  describe("deleteRoutine", () => {
    it("deletes the routine when it belongs to the caller", async () => {
      prisma.routine.findUnique.mockResolvedValue({ id: "r1", userId: "user-1" });
      prisma.routine.delete.mockResolvedValue({ id: "r1" });

      const result = await routineService.deleteRoutine("r1", "user-1");
      expect(result).toEqual({ id: "r1" });
    });

    it("throws 404 if the routine does not exist", async () => {
      prisma.routine.findUnique.mockResolvedValue(null);

      await expect(routineService.deleteRoutine("ghost", "user-1")).rejects.toThrow(
        "Routine not found"
      );
    });

    it("throws 403 if the routine belongs to another user", async () => {
      prisma.routine.findUnique.mockResolvedValue({ id: "r1", userId: "other-user" });

      await expect(routineService.deleteRoutine("r1", "user-1")).rejects.toThrow("Forbidden");
    });
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

    it("throws 404 if the routine does not exist", async () => {
      prisma.routine.findUnique.mockResolvedValue(null);

      await expect(routineService.completeDay("ghost", 1, "user-1")).rejects.toThrow(
        "Routine not found"
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

    it("when both goals have progress, picks the stalest one and reports days-since/percent in the reason", async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      prisma.goal.findMany.mockResolvedValue([
        { id: "goal-fresh", type: "MUSCLE_GAIN", progress: [{ progressPercent: 50, createdAt: oneDayAgo }] },
        { id: "goal-stale", type: "WEIGHT_LOSS", progress: [{ progressPercent: 20, createdAt: tenDaysAgo }] },
      ]);

      const result = await routineService.getSuggestion("user-1");

      expect(result.goalId).toBe("goal-stale");
      expect(result.reason).toMatch(/Last updated \d+ day\(s\) ago at 20% progress/);
    });

    it("breaks ties on days-since-update by picking the lowest progress percent", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      const sameDate = new Date();
      prisma.goal.findMany.mockResolvedValue([
        { id: "goal-high", type: "A", progress: [{ progressPercent: 90, createdAt: sameDate }] },
        { id: "goal-low", type: "B", progress: [{ progressPercent: 10, createdAt: sameDate }] },
      ]);

      const result = await routineService.getSuggestion("user-1");
      expect(result.goalId).toBe("goal-low");
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

    it("creates a PENDING request targeted at a valid trainer", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "trainer-1", role: "TRAINER" });
      prisma.routineRequest.create.mockResolvedValue({
        id: "req-2",
        status: "PENDING",
        trainerId: "trainer-1",
      });

      const result = await routineService.createRoutineRequest("user-1", "trainer-1");

      expect(result.trainerId).toBe("trainer-1");
      expect(prisma.routineRequest.create).toHaveBeenCalledWith({
        data: { userId: "user-1", trainerId: "trainer-1", status: "PENDING" },
      });
    });
  });

  describe("getRoutineRequests", () => {
    it("returns requests addressed to this trainer (or unassigned) when the caller is a TRAINER", async () => {
      prisma.routineRequest.findMany.mockResolvedValue([{ id: "req-1" }]);

      await routineService.getRoutineRequests("trainer-1", "TRAINER");

      expect(prisma.routineRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ trainerId: "trainer-1" }, { trainerId: null }] },
          include: { user: true },
        })
      );
    });

    it("returns requests addressed to this trainer when the caller is an ADMIN", async () => {
      prisma.routineRequest.findMany.mockResolvedValue([]);

      await routineService.getRoutineRequests("admin-1", "ADMIN");

      expect(prisma.routineRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ include: { user: true } })
      );
    });

    it("returns only the caller's own requests when the caller is a regular USER", async () => {
      prisma.routineRequest.findMany.mockResolvedValue([{ id: "req-1" }]);

      await routineService.getRoutineRequests("user-1", "USER");

      expect(prisma.routineRequest.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        include: { trainer: true },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("acceptRoutineRequest / rejectRoutineRequest", () => {
    it("accepts a pending request, assigning it to the calling trainer", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({ id: "req-1", status: "PENDING" });
      prisma.routineRequest.update.mockResolvedValue({
        id: "req-1",
        status: "ACCEPTED",
        trainerId: "trainer-1",
      });

      const result = await routineService.acceptRoutineRequest("req-1", "trainer-1");

      expect(result.status).toBe("ACCEPTED");
      expect(prisma.routineRequest.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: { status: "ACCEPTED", trainerId: "trainer-1" },
      });
    });

    it("throws 404 when accepting a request that does not exist", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(null);

      await expect(routineService.acceptRoutineRequest("ghost", "trainer-1")).rejects.toThrow(
        "Routine request not found"
      );
    });

    it("throws if the request is not pending", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({ id: "req-1", status: "ACCEPTED" });

      await expect(
        routineService.acceptRoutineRequest("req-1", "trainer-1")
      ).rejects.toThrow("Request is not pending");
    });

    it("throws 404 when rejecting a request that does not exist", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(null);

      await expect(routineService.rejectRoutineRequest("ghost", "trainer-1")).rejects.toThrow(
        "Routine request not found"
      );
    });

    it("rejects an unassigned pending request without requiring a specific trainer", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({
        id: "req-1",
        status: "PENDING",
        trainerId: null,
      });
      prisma.routineRequest.update.mockResolvedValue({ id: "req-1", status: "REJECTED" });

      const result = await routineService.rejectRoutineRequest("req-1", "trainer-1");

      expect(result.status).toBe("REJECTED");
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

  describe("completeRoutineRequest", () => {
    it("marks an accepted request as completed by its assigned trainer", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({
        id: "req-1",
        status: "ACCEPTED",
        trainerId: "trainer-1",
      });
      prisma.routineRequest.update.mockResolvedValue({ id: "req-1", status: "COMPLETED" });

      const result = await routineService.completeRoutineRequest("req-1", "trainer-1");

      expect(result.status).toBe("COMPLETED");
    });

    it("throws 404 if the request does not exist", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue(null);

      await expect(
        routineService.completeRoutineRequest("ghost", "trainer-1")
      ).rejects.toThrow("Routine request not found");
    });

    it("throws if the request was never accepted", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({ id: "req-1", status: "PENDING" });

      await expect(
        routineService.completeRoutineRequest("req-1", "trainer-1")
      ).rejects.toThrow("Request must be accepted before completion");
    });

    it("throws if a different trainer than the assigned one tries to complete it", async () => {
      prisma.routineRequest.findUnique.mockResolvedValue({
        id: "req-1",
        status: "ACCEPTED",
        trainerId: "trainer-1",
      });

      await expect(
        routineService.completeRoutineRequest("req-1", "trainer-2")
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("getPatternSuggestion", () => {
    it("returns available:false when there is no training history", async () => {
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: false });
      prisma.userBehaviorProfile.findUnique.mockResolvedValue({
        routines: [],
        topMachines: [],
        frequentDays: [],
      });

      const result = await routineService.getPatternSuggestion("user-1");
      expect(result.available).toBe(false);
    });

    it("returns available:false for users who opted out of machine tracking, even with rich history", async () => {
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: true });
      prisma.userBehaviorProfile.findUnique.mockResolvedValue({
        routines: [{ signature: ["Treadmill", "Bench Press"], occurrences: 8 }],
        topMachines: [{ name: "Treadmill", count: 20 }],
        frequentDays: [{ day: 1, name: "Monday", count: 5, share: 0.5 }],
      });

      const result = await routineService.getPatternSuggestion("user-1");

      expect(result.available).toBe(false);
      // Should not even need to read the behavior profile once opted out.
      expect(prisma.userBehaviorProfile.findUnique).not.toHaveBeenCalled();
    });

    it("suggests a routine from a recurring machine signature, naming the day it usually happens", async () => {
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: false });
      prisma.userBehaviorProfile.findUnique.mockResolvedValue({
        routines: [
          { signature: ["Treadmill", "Bench Press"], occurrences: 5 },
          { signature: ["Squat Rack"], occurrences: 2 }, // below MIN_OCCURRENCES, ignored
        ],
        topMachines: [{ name: "Treadmill", count: 20 }],
        frequentDays: [{ day: 1, name: "Monday", count: 5, share: 0.5 }],
      });

      const result = await routineService.getPatternSuggestion("user-1");

      expect(result.available).toBe(true);
      expect(result.name).toBe("Suggested Routine for Monday");
      expect(result.content.basedOn).toEqual({ type: "RECURRING_PATTERN", occurrences: 5 });
      expect(result.content.exercises).toEqual([
        { machine: "Treadmill" },
        { machine: "Bench Press" },
      ]);
    });

    it("falls back to top machines (lighter-weight guess) when no signature repeats often enough", async () => {
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: false });
      prisma.userBehaviorProfile.findUnique.mockResolvedValue({
        routines: [{ signature: ["Squat Rack"], occurrences: 1 }],
        topMachines: [{ name: "Treadmill", count: 20 }, { name: "Rowing", count: 10 }],
        frequentDays: [],
      });

      const result = await routineService.getPatternSuggestion("user-1");

      expect(result.available).toBe(true);
      expect(result.name).toBe("Suggested Routine (based on your most-used machines)");
      expect(result.content.basedOn).toEqual({ type: "TOP_MACHINES" });
      expect(result.content.exercises).toEqual([{ machine: "Treadmill" }, { machine: "Rowing" }]);
    });
  });

  describe("acceptPatternSuggestion", () => {
    it("saves an override name/content directly without recomputing a suggestion", async () => {
      prisma.routine.create.mockResolvedValue({ id: "r1", name: "Custom name", isCustom: false });

      const result = await routineService.acceptPatternSuggestion("user-1", {
        name: "Custom name",
        content: { exercises: [{ machine: "Treadmill" }] },
      });

      expect(result.name).toBe("Custom name");
      expect(prisma.userSettings.findUnique).not.toHaveBeenCalled();
    });

    it("recomputes and saves the current suggestion when no content override is given", async () => {
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: false });
      prisma.userBehaviorProfile.findUnique.mockResolvedValue({
        routines: [{ signature: ["Treadmill"], occurrences: 5 }],
        topMachines: [],
        frequentDays: [],
      });
      prisma.routine.create.mockResolvedValue({ id: "r1", name: "Suggested Routine", isCustom: false });

      const result = await routineService.acceptPatternSuggestion("user-1");

      expect(result.name).toBe("Suggested Routine");
      expect(prisma.routine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isCustom: false, source: "AI_SUGGESTED" }),
        })
      );
    });

    it("throws when there is no suggestion available to accept", async () => {
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: true });

      await expect(routineService.acceptPatternSuggestion("user-1")).rejects.toThrow();
    });
  });

  describe("rejectPatternSuggestion", () => {
    it("records the dismissal and does not throw even if the notification fails", async () => {
      prisma.notification.create.mockRejectedValue(new Error("db down"));

      const result = await routineService.rejectPatternSuggestion("user-1");

      expect(result).toEqual({ rejected: true });
    });
  });

  describe("getTodayOptions", () => {
    it("returns saved routines, the always-available Free Routine, and a suggestion when available", async () => {
      prisma.routine.findMany.mockResolvedValue([{ id: "r1" }]);
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: false });
      prisma.userBehaviorProfile.findUnique.mockResolvedValue({
        routines: [{ signature: ["Treadmill"], occurrences: 5 }],
        topMachines: [],
        frequentDays: [],
      });

      const result = await routineService.getTodayOptions("user-1");

      expect(result.routines).toEqual([{ id: "r1" }]);
      expect(result.freeRoutine).toEqual({
        id: "FREE_ROUTINE",
        name: "Rutina Libre",
        isFreeRoutine: true,
      });
      expect(result.suggestion).not.toBeNull();
    });

    it("returns suggestion:null when no AI suggestion is available", async () => {
      prisma.routine.findMany.mockResolvedValue([]);
      prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: true });

      const result = await routineService.getTodayOptions("user-1");

      expect(result.suggestion).toBeNull();
    });
  });
});
