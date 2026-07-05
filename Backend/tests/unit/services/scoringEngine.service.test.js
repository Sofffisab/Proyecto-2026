import { describe, it, expect, vi, beforeEach } from "vitest";
import * as scoringEngine from "../../../src/services/scoringEngine.service.js";
import * as difficultyEngine from "../../../src/services/goalDifficultyEngine.service.js";
import { POINTS } from "../../../src/constants/points.js";

vi.mock("../../../src/services/goalDifficultyEngine.service.js", () => ({
  computeGoalDifficultyScore: vi.fn(),
}));

describe("scoringEngine", () => {
  const goal = { type: "STRENGTH", action: "GAIN", targetValue: 40, difficulty: "MEDIUM" };

  beforeEach(() => {
    vi.clearAllMocks();
    difficultyEngine.computeGoalDifficultyScore.mockResolvedValue(1.0);
  });

  it("awards only the flat participation bonus when there is no % progress", async () => {
    const { points, breakdown } = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 50,
      newPercent: 50,
    });

    expect(breakdown.deltaPercent).toBe(0);
    expect(points).toBe(POINTS.PROGRESS_UPDATE);
  });

  it("awards more points for a bigger jump in progress percentage", async () => {
    const small = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 0,
      newPercent: 5,
    });
    const big = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 0,
      newPercent: 50,
    });

    expect(big.points).toBeGreaterThan(small.points);
  });

  it("scales points with the difficulty score", async () => {
    difficultyEngine.computeGoalDifficultyScore.mockResolvedValue(2.0);

    const { points } = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 0,
      newPercent: 50,
    });

    difficultyEngine.computeGoalDifficultyScore.mockResolvedValue(1.0);
    const { points: basePoints } = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 0,
      newPercent: 50,
    });

    expect(points).toBeGreaterThan(basePoints);
  });

  it("adds a one-time completion bonus when the goal crosses 100% for the first time", async () => {
    const withoutCompletion = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 80,
      newPercent: 99,
    });
    const withCompletion = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 80,
      newPercent: 100,
    });

    expect(withCompletion.breakdown.completionBonus).toBeGreaterThan(0);
    expect(withoutCompletion.breakdown.completionBonus).toBe(0);
    expect(withCompletion.points).toBeGreaterThan(withoutCompletion.points);
  });

  it("does not award the completion bonus twice for updates already past 100%", async () => {
    const { breakdown } = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 100,
      newPercent: 110,
    });

    expect(breakdown.completionBonus).toBe(0);
  });

  it("never returns fewer than 1 point", async () => {
    const { points } = await scoringEngine.computeProgressPoints("user-1", goal, {
      previousPercent: 100,
      newPercent: 100,
    });

    expect(points).toBeGreaterThanOrEqual(1);
  });
});
