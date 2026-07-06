import { describe, it, expect, vi, beforeEach } from "vitest";
import * as suggestionEngine from "../../../src/services/suggestionEngine.service.js";
import prisma from "../../../src/config/prisma.js";
import { createNotification, sendEmail } from "../../../src/services/communication.service.js";

vi.mock("../../../src/services/communication.service.js", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
  sendEmail: vi.fn().mockResolvedValue({}),
}));

describe("SuggestionEngineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateUserProgress", () => {
    it("notifies the user if a goal has not been updated in over a week", async () => {
      prisma.goal.findMany.mockResolvedValue([
        { id: "goal-1", type: "WEIGHT_LOSS", createdAt: new Date(), progress: [] },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        email: "user@test.com",
        firstName: "Ana",
        lastHealthEmailAt: null,
      });
      prisma.user.update.mockResolvedValue({});

      await suggestionEngine.evaluateUserProgress("user-1");

      expect(createNotification).toHaveBeenCalledWith(
        "user-1",
        "Don't forget to log your progress",
        expect.stringContaining("WEIGHT_LOSS")
      );
    });

    it("notifies about low progress when the goal is stalled below the threshold", async () => {
      const recent = new Date();
      prisma.goal.findMany.mockResolvedValue([
        {
          id: "goal-1",
          type: "MUSCLE_GAIN",
          createdAt: recent,
          progress: [{ progressPercent: 10, createdAt: recent }],
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        email: "user@test.com",
        firstName: "Ana",
        lastHealthEmailAt: null,
      });
      prisma.user.update.mockResolvedValue({});

      await suggestionEngine.evaluateUserProgress("user-1");

      expect(createNotification).toHaveBeenCalledWith(
        "user-1",
        "Your progress needs attention",
        expect.stringContaining("10%")
      );
    });

    it("recommends a health professional when a goal has stalled for a long time with low progress", async () => {
      const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      prisma.goal.findMany.mockResolvedValue([
        {
          id: "goal-1",
          type: "WEIGHT_LOSS",
          createdAt: longAgo,
          progress: [{ progressPercent: 5, createdAt: new Date() }],
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        email: "user@test.com",
        firstName: "Ana",
        lastHealthEmailAt: null,
      });
      prisma.user.update.mockResolvedValue({});

      await suggestionEngine.evaluateUserProgress("user-1");

      expect(sendEmail).toHaveBeenCalledWith(
        "user@test.com",
        expect.any(String),
        expect.stringContaining("doctor")
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "user-1" } })
      );
    });

    it("does not send a health email again within the cooldown window", async () => {
      const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const recentEmail = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      prisma.goal.findMany.mockResolvedValue([
        {
          id: "goal-1",
          type: "WEIGHT_LOSS",
          createdAt: longAgo,
          progress: [{ progressPercent: 5, createdAt: new Date() }],
        },
      ]);
      prisma.user.findUnique.mockResolvedValue({
        email: "user@test.com",
        firstName: "Ana",
        lastHealthEmailAt: recentEmail,
      });

      await suggestionEngine.evaluateUserProgress("user-1");

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("runSuggestionEngineForAll", () => {
    it("keeps processing other users if one fails", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
      prisma.goal.findMany
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce([]);
      prisma.user.findUnique.mockResolvedValue({ lastHealthEmailAt: null });

      await expect(suggestionEngine.runSuggestionEngineForAll()).resolves.not.toThrow();
      expect(prisma.goal.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
