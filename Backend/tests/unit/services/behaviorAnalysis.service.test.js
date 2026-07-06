import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma.js";
import * as behaviorAnalysis from "../../../src/services/behaviorAnalysis.service.js";

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
});
