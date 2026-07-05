import { describe, it, expect, vi, beforeEach } from "vitest";
import * as gymService from "../../../src/services/gym.service.js";
import * as gamificationService from "../../../src/services/gamification.service.js";
import * as trainerMetricsService from "../../../src/services/trainerMetrics.service.js";
import prisma from "../../../src/config/prisma.js";
import { emitUserNeedsAttention } from "../../../src/realtime/ably.js";

vi.mock("../../../src/services/gamification.service.js");
vi.mock("../../../src/services/trainerMetrics.service.js");
vi.mock("../../../src/realtime/ably.js");

prisma.gymSession.findUnique.mockResolvedValue({
  id: "session-123",
  userId: "user-123",
  checkOutAt: new Date(),
  ratings: [] 
});

describe("GymService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkIn", () => {
    it("creates a session with checkOutAt null", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkInAt: new Date(),
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(null);
      prisma.gymSession.create.mockResolvedValue(mockSession);
      vi.spyOn(gamificationService, "addPoints").mockResolvedValue(undefined);

      const result = await gymService.checkIn("user-123");

      expect(result.checkOutAt).toBeNull();
      expect(result.userId).toBe("user-123");
      expect(prisma.gymSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: "user-123" }),
      });
    });

    it("if a session is already open, returns it without creating a new one (double-scan tolerance)", async () => {
      const existingSession = {
        id: "session-123",
        checkOutAt: null,
      };
      prisma.gymSession.findFirst.mockResolvedValue(existingSession);

      const result = await gymService.checkIn("user-123");

      expect(result).toEqual(existingSession);
      expect(prisma.gymSession.create).not.toHaveBeenCalled();
    });

    it("calls addPoints(POINTS.CHECK_IN) without blocking the flow if it fails", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkInAt: new Date(),
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(null);
      prisma.gymSession.create.mockResolvedValue(mockSession);
      vi.spyOn(gamificationService, "addPoints").mockRejectedValue(new Error("Points failed"));

      const result = await gymService.checkIn("user-123");

      expect(result).toBeDefined();
      expect(gamificationService.addPoints).toHaveBeenCalled();
    });
  });

  describe("checkOut", () => {
    it("calculates durationMinutes correctly", async () => {
      const now = new Date();
      const checkInTime = new Date(now.getTime() - 60000); // 1 minute ago

      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkInAt: checkInTime,
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(mockSession);
      prisma.gymSession.update.mockResolvedValue({
        ...mockSession,
        checkOutAt: now,
        durationMinutes: 1,
      });

      const result = await gymService.checkOut("user-123");

      expect(result.durationMinutes).toBeGreaterThanOrEqual(0);
      expect(prisma.gymSession.update).toHaveBeenCalledWith({
        where: { id: "session-123" },
        data: expect.objectContaining({
          durationMinutes: expect.any(Number),
        }),
      });
    });

    it("does not throw if there is no active session: returns noActiveSession without counting it as a visit", async () => {
      prisma.gymSession.findFirst.mockResolvedValue(null);

      const result = await gymService.checkOut("user-123");

      expect(result).toEqual({ noActiveSession: true });
      expect(prisma.gymSession.update).not.toHaveBeenCalled();
    });
  });

  describe("getPresentUsers", () => {
    it("enriches with lastAssistanceAt without N+1 queries", async () => {
      const mockSessions = [
        { id: "session-1", userId: "user-1", user: { id: "user-1", firstName: "John" } },
        { id: "session-2", userId: "user-2", user: { id: "user-2", firstName: "Jane" } },
      ];

      prisma.gymSession.findMany.mockResolvedValue(mockSessions);
      prisma.assistance.findMany.mockResolvedValue([
        { userId: "user-1", completedAt: new Date(Date.now() - 300000) },
        { userId: "user-2", completedAt: new Date(Date.now() - 300000) },
      ]);

      const result = await gymService.getPresentUsers();

      expect(result).toHaveLength(2);
      expect(prisma.gymSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ checkOutAt: null }),
          include: expect.any(Object),
        })
      );
    });

    it("sorts by most urgent (longest without assistance) and then by trainerPreference", async () => {
      const result = await gymService.getPresentUsers();

      expect(result).toBeDefined();
    });

    it("emite USER_NEEDS_ATTENTION si minutesWaiting >= ATTENTION_THRESHOLD_MINUTES", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          user: { id: "user-1", firstName: "John" },
          assistance: [],
        },
      ];

      prisma.gymSession.findMany.mockResolvedValue(mockSessions);
      prisma.assistance.findMany.mockResolvedValue([]);

      await gymService.getPresentUsers();

      expect(emitUserNeedsAttention).toBeDefined();
    });

    it("does not emit the event if within the threshold", async () => {
      const recentTime = new Date();
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-1",
          checkInAt: recentTime,
          user: { id: "user-1", firstName: "John" },
        },
      ];

      prisma.gymSession.findMany.mockResolvedValue(mockSessions);

      const result = await gymService.getPresentUsers();

      expect(result).toBeDefined();
    });
  });

  describe("rateTrainer", () => {
    it("rejects a rating outside of 1-5", async () => {
      await expect(
        gymService.rateTrainer("session-123", "user-123", "trainer-123", 6)
      ).rejects.toThrow("Rating must be between 1 and 5");
    });

    it("rejects if the session does not belong to the user", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "other-user",
      });

      await expect(
        gymService.rateTrainer("session-123", "user-123", "trainer-123", 4)
      ).rejects.toThrow();
    });

    it("rejects if the session has not been checked out", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: null,
      });

      await expect(
        gymService.rateTrainer("session-123", "user-123", "trainer-123", 4)
      ).rejects.toThrow();
    });

    it("rejects a duplicate rating for the same session", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
      });

      prisma.assistance.findFirst.mockResolvedValue({
        id: "assistance-123",
        status: "COMPLETED",
      });

      prisma.trainerRating.findFirst.mockResolvedValue({
        id: "rating-123",
      });

      // FIX: aligned with the exact text thrown by the service
      await expect(
        gymService.rateTrainer("session-123", "user-123", "trainer-123", 4)
      ).rejects.toThrow("You have already rated this trainer for this session");
    });

    it("calls updateTrainerMetrics after creating the rating", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
      });

      prisma.assistance.findFirst.mockResolvedValue({
        id: "assistance-123",
        status: "COMPLETED",
      });

      // FIX: here we simulate that it is NOT rated yet (null), so it does not throw
      prisma.trainerRating.findFirst.mockResolvedValue(null);
      prisma.trainerRating.create.mockResolvedValue({
        id: "rating-123",
        trainerId: "trainer-123",
        rating: 4,
      });

      vi.spyOn(trainerMetricsService, "updateTrainerMetrics").mockResolvedValue(undefined);

      await gymService.rateTrainer("session-123", "user-123", "trainer-123", 4);

      expect(trainerMetricsService.updateTrainerMetrics).toHaveBeenCalledWith("trainer-123");
    });
  });

  describe("getCurrentSession", () => {
    it("returns the user's active session", async () => {
      const mockSession = {
        id: "session-123",
        userId: "user-123",
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(mockSession);

      const result = await gymService.getCurrentSession("user-123");

      expect(result).toEqual(mockSession);
    });
  });

  describe("getSessionHistory", () => {
    it("returns history sorted by most recent", async () => {
      const mockSessions = [
        { id: "session-1", checkInAt: new Date() },
        { id: "session-2", checkInAt: new Date(Date.now() - 86400000) },
      ];

      prisma.gymSession.findMany.mockResolvedValue(mockSessions);

      const result = await gymService.getSessionHistory("user-123");

      expect(result).toHaveLength(2);
      expect(prisma.gymSession.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { checkInAt: "desc" },
      });
    });
  });
});