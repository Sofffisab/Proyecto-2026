import { describe, it, expect, vi, beforeEach } from "vitest";
import * as difficultyEngine from "../../../src/services/goalDifficultyEngine.service.js";
import * as behaviorAnalysis from "../../../src/services/behaviorAnalysis.service.js";

vi.mock("../../../src/services/behaviorAnalysis.service.js", () => ({
  getUserBehaviorProfile: vi.fn(),
}));

describe("goalDifficultyEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("computeStandardDifficulty", () => {
    it("scores a small WEIGHT goal as easier than a large one", () => {
      const smallGoal = { type: "WEIGHT", action: "LOSE", targetValue: 1, difficulty: "MEDIUM" };
      const largeGoal = { type: "WEIGHT", action: "LOSE", targetValue: 15, difficulty: "MEDIUM" };

      const smallScore = difficultyEngine.computeStandardDifficulty(smallGoal);
      const largeScore = difficultyEngine.computeStandardDifficulty(largeGoal);

      expect(largeScore).toBeGreaterThan(smallScore);
    });

    it("scores gaining muscle as harder than losing the equivalent weight", () => {
      const gainMuscle = { type: "MUSCLE", action: "GAIN", targetValue: 5, difficulty: "MEDIUM" };
      const loseWeight = { type: "WEIGHT", action: "LOSE", targetValue: 5, difficulty: "MEDIUM" };

      const muscleScore = difficultyEngine.computeStandardDifficulty(gainMuscle);
      const weightScore = difficultyEngine.computeStandardDifficulty(loseWeight);

      expect(muscleScore).toBeGreaterThan(weightScore);
    });

    it("falls back to a neutral score for non-physical goal types", () => {
      const goal = { type: "COMMITMENT", action: "MAINTAIN", targetValue: 30, difficulty: "MEDIUM" };
      expect(difficultyEngine.computeStandardDifficulty(goal)).toBe(1.0);
    });
  });

  describe("computePersonalFactor", () => {
    it("returns a neutral factor when there isn't enough behavior history", async () => {
      behaviorAnalysis.getUserBehaviorProfile.mockResolvedValue({
        consistencyScore: null,
        avgSessionsPerWeek: null,
      });

      const factor = await difficultyEngine.computePersonalFactor("user-1");
      expect(factor).toBe(1.0);
    });

    it("boosts the factor for users with irregular attendance", async () => {
      behaviorAnalysis.getUserBehaviorProfile.mockResolvedValue({
        consistencyScore: 0.2,
        avgSessionsPerWeek: 1,
      });

      const factor = await difficultyEngine.computePersonalFactor("user-1");
      expect(factor).toBeGreaterThan(1.0);
    });

    it("discounts the factor for users who train very frequently", async () => {
      behaviorAnalysis.getUserBehaviorProfile.mockResolvedValue({
        consistencyScore: 0.9,
        avgSessionsPerWeek: 6,
      });

      const factor = await difficultyEngine.computePersonalFactor("user-1");
      expect(factor).toBeLessThan(1.0);
    });

    it("keeps the factor within the [0.8, 1.3] bounds", async () => {
      behaviorAnalysis.getUserBehaviorProfile.mockResolvedValue({
        consistencyScore: 0,
        avgSessionsPerWeek: 0,
      });

      const factor = await difficultyEngine.computePersonalFactor("user-1");
      expect(factor).toBeLessThanOrEqual(1.3);
      expect(factor).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("computeGoalDifficultyScore", () => {
    it("combines standard and personal factors and clamps the result", async () => {
      behaviorAnalysis.getUserBehaviorProfile.mockResolvedValue({
        consistencyScore: 0.5,
        avgSessionsPerWeek: 3,
      });

      const goal = { type: "STRENGTH", action: "GAIN", targetValue: 40, difficulty: "HARD" };
      const score = await difficultyEngine.computeGoalDifficultyScore("user-1", goal);

      expect(score).toBeGreaterThanOrEqual(0.4);
      expect(score).toBeLessThanOrEqual(2.5);
    });
  });
});
