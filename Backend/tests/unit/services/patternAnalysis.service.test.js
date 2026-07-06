import { describe, it, expect, vi, beforeEach } from "vitest";
import * as patternAnalysisService from "../../../src/services/patternAnalysis.service.js";
import * as communicationService from "../../../src/services/communication.service.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/services/communication.service.js");

describe("PatternAnalysisService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeUserPatterns", () => {
    it("returns zeroed-out results when the user has no sessions", async () => {
      prisma.gymSession.findMany.mockResolvedValue([]);

      const result = await patternAnalysisService.analyzeUserPatterns("user-1");

      expect(result).toEqual({
        sessionCount: 0,
        frequentDays: [],
        topMachines: [],
      });
    });

    it("counts weekday frequency and ranks the top machines by usage", async () => {
      // 2026-01-05 is a Monday, 2026-01-12 is also a Monday.
      prisma.gymSession.findMany.mockResolvedValue([
        {
          checkInAt: new Date("2026-01-05T10:00:00Z"),
          machineUsages: [{ machine: { name: "Treadmill" } }],
        },
        {
          checkInAt: new Date("2026-01-12T10:00:00Z"),
          machineUsages: [
            { machine: { name: "Treadmill" } },
            { machine: { name: "Bike" } },
          ],
        },
      ]);

      const result = await patternAnalysisService.analyzeUserPatterns("user-1");

      expect(result.sessionCount).toBe(2);
      expect(result.frequentDays[0]).toMatchObject({ name: "Monday", count: 2 });
      expect(result.topMachines[0]).toMatchObject({ name: "Treadmill", count: 2 });
      expect(result.topMachines).toHaveLength(2);
    });

    it("limits topMachines to the 5 most-used machines", async () => {
      const usages = Array.from({ length: 6 }, (_, i) => ({
        machine: { name: `Machine ${i}` },
      }));
      prisma.gymSession.findMany.mockResolvedValue([
        { checkInAt: new Date("2026-01-05T10:00:00Z"), machineUsages: usages },
      ]);

      const result = await patternAnalysisService.analyzeUserPatterns("user-1");

      expect(result.topMachines).toHaveLength(5);
    });
  });

  describe("runPatternAnalysisForAll", () => {
    it("sends a notification summarizing the top day and machine for each active user with sessions", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
      prisma.gymSession.findMany.mockResolvedValue([
        {
          checkInAt: new Date("2026-01-05T10:00:00Z"),
          machineUsages: [{ machine: { name: "Treadmill" } }],
        },
      ]);
      communicationService.createNotification.mockResolvedValue(undefined);

      await patternAnalysisService.runPatternAnalysisForAll();

      expect(communicationService.createNotification).toHaveBeenCalledWith(
        "user-1",
        "Your training patterns",
        expect.stringContaining("Monday")
      );
    });

    it("skips users with zero sessions without sending a notification", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
      prisma.gymSession.findMany.mockResolvedValue([]);

      await patternAnalysisService.runPatternAnalysisForAll();

      expect(communicationService.createNotification).not.toHaveBeenCalled();
    });

    it("does not let one user's failure stop the batch", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
      prisma.gymSession.findMany
        .mockRejectedValueOnce(new Error("db error"))
        .mockResolvedValueOnce([
          {
            checkInAt: new Date("2026-01-05T10:00:00Z"),
            machineUsages: [{ machine: { name: "Bike" } }],
          },
        ]);
      communicationService.createNotification.mockResolvedValue(undefined);

      await expect(patternAnalysisService.runPatternAnalysisForAll()).resolves.toBeUndefined();

      expect(communicationService.createNotification).toHaveBeenCalledTimes(1);
      expect(communicationService.createNotification).toHaveBeenCalledWith(
        "user-2",
        "Your training patterns",
        expect.any(String)
      );
    });

    it("does nothing when there are no active users", async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await patternAnalysisService.runPatternAnalysisForAll();

      expect(communicationService.createNotification).not.toHaveBeenCalled();
    });
  });
});
