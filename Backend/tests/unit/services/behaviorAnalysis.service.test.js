import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma.js";
import * as behaviorAnalysis from "../../../src/services/behaviorAnalysis.service.js";
import * as communicationService from "../../../src/services/communication.service.js";

vi.mock("../../../src/services/communication.service.js");

function session(checkInAt, machineNames) {
  return {
    checkInAt,
    machineUsages: machineNames.map((name) => ({ machine: { name } })),
  };
}

describe("behaviorAnalysis.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed-out patterns when the user has no sessions", async () => {
    prisma.gymSession.findMany.mockResolvedValue([]);

    const result = await behaviorAnalysis.analyzeUserPatterns("user-1");

    expect(result.sessionCount).toBe(0);
    expect(result.frequentDays).toEqual([]);
    expect(result.routines).toEqual([]);
    expect(result.consistencyScore).toBeNull();
  });

  it("detects a recurring routine repeated across sessions", async () => {
    const base = new Date("2026-01-05T08:00:00Z"); // Monday
    const sessions = [0, 7, 14, 21].map((offsetDays) =>
      session(
        new Date(base.getTime() + offsetDays * 86400000),
        ["Treadmill", "Bench Press"]
      )
    );
    prisma.gymSession.findMany.mockResolvedValue(sessions);

    const result = await behaviorAnalysis.analyzeUserPatterns("user-1");

    expect(result.routines.length).toBeGreaterThan(0);
    expect(result.routines[0].occurrences).toBe(4);
    expect(result.routines[0].signature).toEqual(["Bench Press", "Treadmill"]);
  });

  it("does not report a routine seen fewer than the minimum occurrences", async () => {
    const base = new Date("2026-01-05T08:00:00Z");
    const sessions = [0, 7].map((offsetDays) =>
      session(new Date(base.getTime() + offsetDays * 86400000), ["Rowing Machine"])
    );
    prisma.gymSession.findMany.mockResolvedValue(sessions);

    const result = await behaviorAnalysis.analyzeUserPatterns("user-1");
    expect(result.routines).toEqual([]);
  });

  it("gives a high consistency score to a perfectly regular weekly cadence", async () => {
    const base = new Date("2026-01-05T08:00:00Z");
    const sessions = [0, 7, 14, 21, 28].map((offsetDays) =>
      session(new Date(base.getTime() + offsetDays * 86400000), ["Treadmill"])
    );
    prisma.gymSession.findMany.mockResolvedValue(sessions);

    const result = await behaviorAnalysis.analyzeUserPatterns("user-1");
    expect(result.consistencyScore).toBeGreaterThan(0.9);
  });

  it("gives a lower consistency score to a highly irregular cadence", async () => {
    const base = new Date("2026-01-05T08:00:00Z").getTime();
    const offsets = [0, 1, 15, 16, 45];
    const sessions = offsets.map((offsetDays) =>
      session(new Date(base + offsetDays * 86400000), ["Treadmill"])
    );
    prisma.gymSession.findMany.mockResolvedValue(sessions);

    const result = await behaviorAnalysis.analyzeUserPatterns("user-1");
    expect(result.consistencyScore).toBeLessThan(0.9);
  });

  describe("getUserBehaviorProfile", () => {
    it("returns the cached profile when one exists", async () => {
      const cached = { userId: "user-1", sessionCount: 10, consistencyScore: 0.8 };
      prisma.userBehaviorProfile.findUnique.mockResolvedValue(cached);

      const result = await behaviorAnalysis.getUserBehaviorProfile("user-1");
      expect(result).toEqual(cached);
      expect(prisma.gymSession.findMany).not.toHaveBeenCalled();
    });

    it("computes on demand when there is no cached profile yet", async () => {
      prisma.userBehaviorProfile.findUnique.mockResolvedValue(null);
      prisma.gymSession.findMany.mockResolvedValue([]);

      const result = await behaviorAnalysis.getUserBehaviorProfile("user-1");
      expect(result.sessionCount).toBe(0);
      expect(result.calculatedAt).toBeNull();
    });
  });

  describe("awardConsistencyBonus", () => {
    it("awards the bonus when both thresholds are met and it hasn't been given this week", async () => {
      prisma.pointTransaction.findFirst.mockResolvedValue(null);
      prisma.pointTransaction.create.mockResolvedValue({});
      prisma.reward.findMany.mockResolvedValue([]);

      const result = await behaviorAnalysis.awardConsistencyBonus("user-1", {
        consistencyScore: 0.9,
        avgSessionsPerWeek: 3,
      });

      expect(result).not.toBeNull();
      expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            points: 25,
          }),
        })
      );
    });

    it("does not award when consistency is below the threshold", async () => {
      const result = await behaviorAnalysis.awardConsistencyBonus("user-1", {
        consistencyScore: 0.3,
        avgSessionsPerWeek: 3,
      });

      expect(result).toBeNull();
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    });

    it("does not award when sessions per week are below the threshold", async () => {
      const result = await behaviorAnalysis.awardConsistencyBonus("user-1", {
        consistencyScore: 0.9,
        avgSessionsPerWeek: 0.5,
      });

      expect(result).toBeNull();
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    });

    it("does not award twice in the same week", async () => {
      prisma.pointTransaction.findFirst.mockResolvedValue({ id: "existing-tx" });

      const result = await behaviorAnalysis.awardConsistencyBonus("user-1", {
        consistencyScore: 0.9,
        avgSessionsPerWeek: 3,
      });

      expect(result).toBeNull();
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    });

    it("does not award when there isn't enough data yet (null values)", async () => {
      const result = await behaviorAnalysis.awardConsistencyBonus("user-1", {
        consistencyScore: null,
        avgSessionsPerWeek: null,
      });

      expect(result).toBeNull();
      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe("refreshUserBehaviorProfile", () => {
    it("upserts the computed patterns into the behavior profile table", async () => {
      prisma.gymSession.findMany.mockResolvedValue([]);
      prisma.userBehaviorProfile.upsert.mockResolvedValue({ userId: "user-1" });

      await behaviorAnalysis.refreshUserBehaviorProfile("user-1");

      expect(prisma.userBehaviorProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          update: expect.objectContaining({
            sessionCount: 0,
            calculatedAt: expect.any(Date),
          }),
          create: expect.objectContaining({
            userId: "user-1",
            sessionCount: 0,
          }),
        })
      );
    });

    it("treats same-timestamp check-ins (zero average gap) as perfectly consistent", async () => {
      const sameInstant = new Date("2026-01-05T08:00:00Z");
      const sessions = [
        session(sameInstant, ["Treadmill"]),
        session(sameInstant, ["Treadmill"]),
        session(sameInstant, ["Treadmill"]),
      ];
      prisma.gymSession.findMany.mockResolvedValue(sessions);
      prisma.userBehaviorProfile.upsert.mockResolvedValue({});

      await behaviorAnalysis.refreshUserBehaviorProfile("user-1");

      expect(prisma.userBehaviorProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            consistencyScore: 1,
            avgSessionsPerWeek: 7,
          }),
        })
      );
    });
  });

  describe("runPatternAnalysisForAll", () => {
    it("skips users with zero sessions", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
      prisma.gymSession.findMany.mockResolvedValue([]);

      await behaviorAnalysis.runPatternAnalysisForAll();

      expect(prisma.userBehaviorProfile.upsert).not.toHaveBeenCalled();
      expect(communicationService.createNotification).not.toHaveBeenCalled();
    });

    it("refreshes the profile and sends a notification summarising the top day/machine/routine", async () => {
      const base = new Date("2026-01-05T08:00:00Z"); // Monday
      const sessions = [0, 7, 14, 21].map((offsetDays) =>
        session(new Date(base.getTime() + offsetDays * 86400000), ["Treadmill", "Bench Press"])
      );

      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
      prisma.gymSession.findMany.mockResolvedValue(sessions);
      prisma.userBehaviorProfile.upsert.mockResolvedValue({});
      prisma.pointTransaction.findFirst.mockResolvedValue({ id: "already-awarded" });
      communicationService.createNotification.mockResolvedValue({});

      await behaviorAnalysis.runPatternAnalysisForAll();
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.userBehaviorProfile.upsert).toHaveBeenCalled();
      expect(communicationService.createNotification).toHaveBeenCalledWith(
        "user-1",
        "Your training patterns",
        expect.stringContaining("Monday")
      );
    });

    it("continues processing remaining users when one user's analysis throws", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
      prisma.gymSession.findMany
        .mockRejectedValueOnce(new Error("db exploded for user-1"))
        .mockResolvedValueOnce([]);

      await expect(behaviorAnalysis.runPatternAnalysisForAll()).resolves.not.toThrow();

      expect(prisma.gymSession.findMany).toHaveBeenCalledTimes(2);
    });

    it("does not let an awardConsistencyBonus failure break the loop", async () => {
      const base = new Date("2026-01-05T08:00:00Z");
      // Evenly spaced every 3 days => perfectly consistent and well above the
      // 2-sessions/week bonus threshold, so awardConsistencyBonus actually
      // reaches the point-transaction lookup below (instead of bailing out
      // early on the threshold check).
      const sessions = [0, 3, 6, 9, 12].map((offsetDays) =>
        session(new Date(base.getTime() + offsetDays * 86400000), ["Treadmill"])
      );

      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }]);
      prisma.gymSession.findMany.mockResolvedValue(sessions);
      prisma.userBehaviorProfile.upsert.mockResolvedValue({});
      prisma.pointTransaction.findFirst.mockRejectedValue(new Error("points db down"));
      communicationService.createNotification.mockResolvedValue({});

      await expect(behaviorAnalysis.runPatternAnalysisForAll()).resolves.not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.pointTransaction.findFirst).toHaveBeenCalled();
    });
  });
});
