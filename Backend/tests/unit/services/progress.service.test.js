import { describe, it, expect, vi, beforeEach } from "vitest";
import * as progressService from "../../../src/services/progress.service.js";
import * as gamificationService from "../../../src/services/gamification.service.js";
import * as scoringEngineService from "../../../src/services/scoringEngine.service.js";
import prisma from "../../../src/config/prisma.js";

describe("ProgressService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("addProgress", () => {
    const goal = {
      id: "goal-1",
      userId: "user-123",
      type: "WEIGHT",
      action: "LOSE",
      currentValue: 20,
      targetValue: 100,
    };

    it("rejects when the goal does not exist", async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(progressService.addProgress("user-123", "goal-1", 10)).rejects.toThrow(
        "Goal not found"
      );
    });

    it("rejects when the goal belongs to a different user", async () => {
      prisma.goal.findUnique.mockResolvedValue({ ...goal, userId: "other-user" });

      await expect(progressService.addProgress("user-123", "goal-1", 10)).rejects.toThrow(
        "Forbidden: goal does not belong to this user"
      );
    });

    it("updates the goal's currentValue, creates a progress entry, and awards points", async () => {
      prisma.goal.findUnique.mockResolvedValue(goal);
      prisma.goal.update.mockResolvedValue({ ...goal, currentValue: 30 });
      const mockEntry = { id: "entry-1", userId: "user-123", goalId: "goal-1", value: 10 };
      prisma.progressEntry.create.mockResolvedValue(mockEntry);

      vi.spyOn(scoringEngineService, "computeProgressPoints").mockResolvedValue({
        points: 25,
        breakdown: { difficultyScore: 1.5, deltaPercent: 10 },
      });
      vi.spyOn(gamificationService, "addPoints").mockResolvedValue(undefined);

      const result = await progressService.addProgress("user-123", "goal-1", 10);

      expect(prisma.goal.update).toHaveBeenCalledWith({
        where: { id: "goal-1" },
        data: { currentValue: 30 },
      });
      expect(prisma.progressEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-123", goalId: "goal-1", value: 10 }),
      });
      expect(result).toBe(mockEntry);

      // addPoints is fired non-blocking, flush microtasks before asserting
      await new Promise((resolve) => setImmediate(resolve));
      expect(gamificationService.addPoints).toHaveBeenCalledWith(
        "user-123",
        25,
        expect.stringContaining("Progress update")
      );
    });

    it("computes progressPercent as 0 when targetValue is 0 (no division by zero)", async () => {
      const zeroTargetGoal = { ...goal, targetValue: 0, currentValue: 0 };
      prisma.goal.findUnique.mockResolvedValue(zeroTargetGoal);
      prisma.goal.update.mockResolvedValue(zeroTargetGoal);
      prisma.progressEntry.create.mockImplementation(({ data }) => Promise.resolve(data));

      vi.spyOn(scoringEngineService, "computeProgressPoints").mockResolvedValue({
        points: 0,
        breakdown: { difficultyScore: 1, deltaPercent: 0 },
      });
      vi.spyOn(gamificationService, "addPoints").mockResolvedValue(undefined);

      const result = await progressService.addProgress("user-123", "goal-1", 5);

      expect(result.progressPercent).toBe(0);
    });

    it("does not propagate an addPoints failure (fire-and-forget, logged instead)", async () => {
      prisma.goal.findUnique.mockResolvedValue(goal);
      prisma.goal.update.mockResolvedValue(goal);
      prisma.progressEntry.create.mockResolvedValue({ id: "entry-1" });

      vi.spyOn(scoringEngineService, "computeProgressPoints").mockResolvedValue({
        points: 10,
        breakdown: { difficultyScore: 1, deltaPercent: 5 },
      });
      vi.spyOn(gamificationService, "addPoints").mockRejectedValue(new Error("points failed"));

      await expect(progressService.addProgress("user-123", "goal-1", 10)).resolves.toBeDefined();

      await new Promise((resolve) => setImmediate(resolve));
    });
  });

  describe("getProgressEntryById", () => {
    it("returns the entry when it belongs to the caller", async () => {
      const entry = { id: "entry-1", userId: "user-123" };
      prisma.progressEntry.findUnique.mockResolvedValue(entry);

      const result = await progressService.getProgressEntryById("entry-1", "user-123");

      expect(result).toBe(entry);
    });

    it("throws when the entry does not exist", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue(null);

      await expect(
        progressService.getProgressEntryById("missing", "user-123")
      ).rejects.toThrow("Progress entry not found");
    });

    it("throws Forbidden when the entry belongs to another user", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue({ id: "entry-1", userId: "other-user" });

      await expect(
        progressService.getProgressEntryById("entry-1", "user-123")
      ).rejects.toThrow("Forbidden");
    });
  });

  describe("updateProgressEntry", () => {
    const entry = { id: "entry-1", userId: "user-123", goalId: "goal-1", value: 10 };
    const goal = { id: "goal-1", userId: "user-123", currentValue: 30, targetValue: 100 };

    it("throws when the entry does not exist", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue(null);

      await expect(
        progressService.updateProgressEntry("missing", "user-123", { note: "x" })
      ).rejects.toThrow("Progress entry not found");
    });

    it("throws Forbidden when the entry belongs to another user", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue({ ...entry, userId: "other-user" });

      await expect(
        progressService.updateProgressEntry("entry-1", "user-123", { note: "x" })
      ).rejects.toThrow("Forbidden");
    });

    it("updates only the note when value is not provided", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue(entry);
      prisma.progressEntry.update.mockResolvedValue({ ...entry, note: "Felt great" });

      await progressService.updateProgressEntry("entry-1", "user-123", { note: "Felt great" });

      expect(prisma.goal.update).not.toHaveBeenCalled();
      expect(prisma.progressEntry.update).toHaveBeenCalledWith({
        where: { id: "entry-1" },
        data: { note: "Felt great" },
      });
    });

    it("recomputes the goal's currentValue and progressPercent when value changes", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue(entry);
      prisma.goal.findUnique.mockResolvedValue(goal);
      prisma.goal.update.mockResolvedValue({ ...goal, currentValue: 40 });
      prisma.progressEntry.update.mockResolvedValue({ ...entry, value: 20 });

      await progressService.updateProgressEntry("entry-1", "user-123", { value: 20, note: "n" });

      // newValue = goal.currentValue(30) - entry.value(10) + newValue(20) = 40
      expect(prisma.goal.update).toHaveBeenCalledWith({
        where: { id: "goal-1" },
        data: { currentValue: 40 },
      });
      expect(prisma.progressEntry.update).toHaveBeenCalledWith({
        where: { id: "entry-1" },
        data: expect.objectContaining({ value: 20, progressPercent: 40 }),
      });
    });
  });

  describe("deleteProgressEntry", () => {
    const entry = { id: "entry-1", userId: "user-123", goalId: "goal-1", value: 10 };

    it("throws when the entry does not exist", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue(null);

      await expect(
        progressService.deleteProgressEntry("missing", "user-123")
      ).rejects.toThrow("Progress entry not found");
    });

    it("throws Forbidden when the entry belongs to another user", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue({ ...entry, userId: "other-user" });

      await expect(
        progressService.deleteProgressEntry("entry-1", "user-123")
      ).rejects.toThrow("Forbidden");
    });

    it("decrements the goal's currentValue (floored at 0) and deletes the entry", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue(entry);
      prisma.goal.findUnique.mockResolvedValue({ id: "goal-1", currentValue: 5 });
      prisma.goal.update.mockResolvedValue({});
      prisma.progressEntry.delete.mockResolvedValue(entry);

      await progressService.deleteProgressEntry("entry-1", "user-123");

      // currentValue(5) - entry.value(10) would be negative -> floored at 0
      expect(prisma.goal.update).toHaveBeenCalledWith({
        where: { id: "goal-1" },
        data: { currentValue: 0 },
      });
      expect(prisma.progressEntry.delete).toHaveBeenCalledWith({ where: { id: "entry-1" } });
    });

    it("skips goal adjustment when the parent goal no longer exists", async () => {
      prisma.progressEntry.findUnique.mockResolvedValue(entry);
      prisma.goal.findUnique.mockResolvedValue(null);
      prisma.progressEntry.delete.mockResolvedValue(entry);

      await progressService.deleteProgressEntry("entry-1", "user-123");

      expect(prisma.goal.update).not.toHaveBeenCalled();
      expect(prisma.progressEntry.delete).toHaveBeenCalled();
    });
  });

  describe("getProgressStats", () => {
    it("aggregates entry/goal counts and the last entry date", async () => {
      prisma.progressEntry.count.mockResolvedValue(12);
      prisma.goal.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
      const lastEntry = { createdAt: new Date("2026-01-01T00:00:00Z") };
      prisma.progressEntry.findFirst.mockResolvedValue(lastEntry);

      const result = await progressService.getProgressStats("user-123");

      expect(result).toEqual({
        totalEntries: 12,
        totalGoals: 3,
        activeGoals: 2,
        lastEntryAt: lastEntry.createdAt,
      });
    });

    it("returns lastEntryAt: null when there are no entries", async () => {
      prisma.progressEntry.count.mockResolvedValue(0);
      prisma.goal.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.progressEntry.findFirst.mockResolvedValue(null);

      const result = await progressService.getProgressStats("user-123");

      expect(result.lastEntryAt).toBeNull();
    });
  });

  describe("Goal CRUD", () => {
    it("createGoal persists the goal with currentValue 0 and active true, renaming objective fields", async () => {
      const mockGoal = { id: "goal-1" };
      prisma.goal.create.mockResolvedValue(mockGoal);

      const result = await progressService.createGoal("user-123", {
        objectiveType: "WEIGHT",
        objectiveAction: "LOSE",
        targetValue: 80,
        unit: "kg",
      });

      expect(prisma.goal.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          targetValue: 80,
          currentValue: 0,
          unit: "kg",
          type: "WEIGHT",
          action: "LOSE",
          active: true,
        },
      });
      expect(result).toBe(mockGoal);
    });

    it("getGoals returns only the caller's active goals", async () => {
      const goals = [{ id: "goal-1" }];
      prisma.goal.findMany.mockResolvedValue(goals);

      const result = await progressService.getGoals("user-123");

      expect(prisma.goal.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123", active: true },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toBe(goals);
    });

    describe("getGoalById", () => {
      it("returns the goal when owned by the caller", async () => {
        const goal = { id: "goal-1", userId: "user-123" };
        prisma.goal.findUnique.mockResolvedValue(goal);

        const result = await progressService.getGoalById("goal-1", "user-123");

        expect(result).toBe(goal);
      });

      it("throws when the goal does not exist", async () => {
        prisma.goal.findUnique.mockResolvedValue(null);

        await expect(progressService.getGoalById("missing", "user-123")).rejects.toThrow(
          "Goal not found"
        );
      });

      it("throws Forbidden when the goal belongs to another user", async () => {
        prisma.goal.findUnique.mockResolvedValue({ id: "goal-1", userId: "other-user" });

        await expect(progressService.getGoalById("goal-1", "user-123")).rejects.toThrow(
          "Forbidden"
        );
      });
    });

    describe("updateGoal", () => {
      it("throws when the goal does not exist", async () => {
        prisma.goal.findUnique.mockResolvedValue(null);

        await expect(
          progressService.updateGoal("missing", "user-123", { unit: "kg" })
        ).rejects.toThrow("Goal not found");
      });

      it("throws Forbidden when the goal belongs to another user", async () => {
        prisma.goal.findUnique.mockResolvedValue({ id: "goal-1", userId: "other-user" });

        await expect(
          progressService.updateGoal("goal-1", "user-123", { unit: "kg" })
        ).rejects.toThrow("Forbidden");
      });

      it("renames objectiveType/objectiveAction to type/action before updating", async () => {
        prisma.goal.findUnique.mockResolvedValue({ id: "goal-1", userId: "user-123" });
        prisma.goal.update.mockResolvedValue({});

        await progressService.updateGoal("goal-1", "user-123", {
          objectiveType: "DISTANCE",
          objectiveAction: "RUN",
          targetValue: 42,
        });

        expect(prisma.goal.update).toHaveBeenCalledWith({
          where: { id: "goal-1" },
          data: { type: "DISTANCE", action: "RUN", targetValue: 42 },
        });
      });

      it("passes data through unchanged when no objective fields are provided", async () => {
        prisma.goal.findUnique.mockResolvedValue({ id: "goal-1", userId: "user-123" });
        prisma.goal.update.mockResolvedValue({});

        await progressService.updateGoal("goal-1", "user-123", { unit: "reps" });

        expect(prisma.goal.update).toHaveBeenCalledWith({
          where: { id: "goal-1" },
          data: { unit: "reps" },
        });
      });
    });

    describe("deleteGoal", () => {
      it("throws when the goal does not exist", async () => {
        prisma.goal.findUnique.mockResolvedValue(null);

        await expect(progressService.deleteGoal("missing", "user-123")).rejects.toThrow(
          "Goal not found"
        );
      });

      it("throws Forbidden when the goal belongs to another user", async () => {
        prisma.goal.findUnique.mockResolvedValue({ id: "goal-1", userId: "other-user" });

        await expect(progressService.deleteGoal("goal-1", "user-123")).rejects.toThrow(
          "Forbidden"
        );
      });

      it("deletes the goal when owned by the caller", async () => {
        prisma.goal.findUnique.mockResolvedValue({ id: "goal-1", userId: "user-123" });
        prisma.goal.delete.mockResolvedValue({ id: "goal-1" });

        const result = await progressService.deleteGoal("goal-1", "user-123");

        expect(prisma.goal.delete).toHaveBeenCalledWith({ where: { id: "goal-1" } });
        expect(result).toEqual({ id: "goal-1" });
      });
    });
  });

  describe("addProgressLog / createGoal", () => {
    it("creates a valid log/goal", async () => {
      const mockLog = {
        id: "log-123",
        userId: "user-123",
        metric: "weight",
        value: 75.5,
        date: new Date(),
      };

      prisma.progressLog.findFirst.mockResolvedValue(null);
      prisma.progressLog.create.mockResolvedValue(mockLog);

      const result = await progressService.addProgressLog("user-123", {
        metric: "weight",
        value: 75.5,
      });

      expect(result.metric).toBe("weight");
      expect(result.value).toBe(75.5);
      expect(prisma.progressLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          metric: "weight",
          value: 75.5,
        }),
      });
    });
  });

  describe("metrics", () => {
    it("prevents duplicate metrics on the same day", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.progressLog.findFirst.mockResolvedValue({
        id: "log-123",
        date: today,
      });

      await expect(
        progressService.addProgressLog("user-123", { metric: "weight", value: 75 })
      ).rejects.toThrow("Already logged today");
    });

    it("allows updating if forced", async () => {
      const mockLog = {
        id: "log-123",
        userId: "user-123",
        metric: "weight",
        value: 76,
      };

      prisma.progressLog.upsert.mockResolvedValue(mockLog);

      const result = await progressService.addProgressLog(
        "user-123",
        { metric: "weight", value: 76 },
        { force: true }
      );

      expect(result.value).toBe(76);
      expect(prisma.progressLog.upsert).toHaveBeenCalled();
    });
  });

  describe("streak", () => {
    it("calculates the current streak correctly", async () => {
      const mockLogs = [
        { date: new Date() },
        { date: new Date(Date.now() - 86400000) },
        { date: new Date(Date.now() - 2 * 86400000) },
      ];

      prisma.progressLog.findMany.mockResolvedValue(mockLogs);

      const result = await progressService.getCurrentStreak("user-123", "weight");

      expect(result).toBeGreaterThan(0);
    });

    it("breaks the streak if a day is missed", async () => {
      const mockLogs = [
        { date: new Date() },
        { date: new Date(Date.now() - 2 * 86400000) }, // Missing yesterday
      ];

      prisma.progressLog.findMany.mockResolvedValue(mockLogs);

      const result = await progressService.getCurrentStreak("user-123", "weight");

      expect(result).toBe(1); // Only today
    });

    it("calculates the longest historical streak", async () => {
      const mockStreaks = [
        { maxStreak: 30 },
      ];

      prisma.progressMetric.findMany.mockResolvedValue(mockStreaks);

      const result = await progressService.getLongestStreak("user-123", "weight");

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getProgressHistory", () => {
    it("filters by date range and paginates", async () => {
      const mockLogs = [
        { id: "log-1", metric: "weight", value: 75 },
        { id: "log-2", metric: "weight", value: 74.5 },
      ];

      prisma.progressLog.findMany.mockResolvedValue(mockLogs);

      const result = await progressService.getProgressHistory("user-123", {
        metric: "weight",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveLength(2);
      expect(prisma.progressLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: "user-123",
          metric: "weight",
        }),
        orderBy: { date: "desc" },
        take: 10,
        skip: 0,
      });
    });
  });
});