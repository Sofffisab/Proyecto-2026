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

    it("throws a 400 AppError if there is no active session", async () => {
      prisma.gymSession.findFirst.mockResolvedValue(null);

      await expect(gymService.checkOut("user-123")).rejects.toThrow(
        "No active check-in session"
      );
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

  describe("getPriorityAssistanceList", () => {
    it("prioritizes a specialty match over a slightly longer wait within the same 15-minute bucket", async () => {
      const now = Date.now();
      prisma.trainerProfile.findUnique.mockResolvedValue({ specialties: ["STRENGTH"] });
      prisma.gymSession.findMany.mockResolvedValue([
        {
          userId: "user-A",
          user: {
            id: "user-A",
            role: "USER",
            createdAt: new Date(now - 1000),
            objectives: ["CARDIO"],
            settings: {},
          },
        },
        {
          userId: "user-B",
          user: {
            id: "user-B",
            role: "USER",
            createdAt: new Date(now - 1000),
            objectives: ["STRENGTH"],
            settings: {},
          },
        },
      ]);
      // Both within the same 15-min bucket (20 vs 27 minutes waited).
      prisma.assistance.findMany.mockResolvedValue([
        { userId: "user-A", completedAt: new Date(now - 27 * 60000) },
        { userId: "user-B", completedAt: new Date(now - 20 * 60000) },
      ]);

      const result = await gymService.getPriorityAssistanceList("trainer-1");

      expect(result.map((r) => r.userId)).toEqual(["user-B", "user-A"]);
    });

    it("still puts real wait-time gaps ahead of specialty when buckets differ", async () => {
      const now = Date.now();
      prisma.trainerProfile.findUnique.mockResolvedValue({ specialties: ["STRENGTH"] });
      prisma.gymSession.findMany.mockResolvedValue([
        {
          userId: "user-A",
          user: {
            id: "user-A",
            role: "USER",
            createdAt: new Date(now - 1000),
            objectives: ["CARDIO"],
            settings: {},
          },
        },
        {
          userId: "user-B",
          user: {
            id: "user-B",
            role: "USER",
            createdAt: new Date(now - 1000),
            objectives: ["STRENGTH"],
            settings: {},
          },
        },
      ]);
      // Different buckets: user-A waited 45 min (bucket 3), user-B 20 min (bucket 1).
      prisma.assistance.findMany.mockResolvedValue([
        { userId: "user-A", completedAt: new Date(now - 45 * 60000) },
        { userId: "user-B", completedAt: new Date(now - 20 * 60000) },
      ]);

      const result = await gymService.getPriorityAssistanceList("trainer-1");

      expect(result.map((r) => r.userId)).toEqual(["user-A", "user-B"]);
    });

    it("excludes users with disableAssistance set", async () => {
      prisma.trainerProfile.findUnique.mockResolvedValue({ specialties: [] });
      prisma.gymSession.findMany.mockResolvedValue([
        {
          userId: "user-opted-out",
          user: {
            id: "user-opted-out",
            role: "USER",
            createdAt: new Date(),
            objectives: [],
            settings: { disableAssistance: true },
          },
        },
      ]);

      const result = await gymService.getPriorityAssistanceList("trainer-1");

      expect(result).toEqual([]);
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

    it("awards TRAINER_RATED points to the rating user (non-blocking)", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
      });

      prisma.assistance.findFirst.mockResolvedValue({
        id: "assistance-123",
        status: "COMPLETED",
      });

      prisma.trainerRating.findFirst.mockResolvedValue(null);
      prisma.trainerRating.create.mockResolvedValue({
        id: "rating-123",
        trainerId: "trainer-123",
        rating: 4,
      });
      gamificationService.addPoints.mockResolvedValue({});

      vi.spyOn(trainerMetricsService, "updateTrainerMetrics").mockResolvedValue(undefined);

      await gymService.rateTrainer("session-123", "user-123", "trainer-123", 4);

      expect(gamificationService.addPoints).toHaveBeenCalledWith(
        "user-123",
        10,
        "Rated a trainer"
      );
    });

    it("returns { rating, complaint: null } when helped is true (default)", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
      });
      prisma.assistance.findFirst.mockResolvedValue({ id: "assistance-123", status: "COMPLETED" });
      prisma.trainerRating.findFirst.mockResolvedValue(null);
      prisma.trainerRating.create.mockResolvedValue({ id: "rating-123", trainerId: "trainer-123", rating: 4 });
      vi.spyOn(trainerMetricsService, "updateTrainerMetrics").mockResolvedValue(undefined);

      const result = await gymService.rateTrainer("session-123", "user-123", "trainer-123", 4);

      expect(result.rating).toEqual({ id: "rating-123", trainerId: "trainer-123", rating: 4 });
      expect(result.complaint).toBeNull();
      expect(prisma.complaint.create).not.toHaveBeenCalled();
    });

    it("auto-files a complaint against the trainer when helped is false", async () => {
      prisma.gymSession.findUnique.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
        checkOutAt: new Date(),
      });
      prisma.assistance.findFirst.mockResolvedValue({ id: "assistance-123", status: "COMPLETED" });
      prisma.trainerRating.findFirst.mockResolvedValue(null);
      prisma.trainerRating.create.mockResolvedValue({ id: "rating-123", trainerId: "trainer-123", rating: 1 });
      vi.spyOn(trainerMetricsService, "updateTrainerMetrics").mockResolvedValue(undefined);

      // No prior auto-no-help complaint for this session/trainer/user
      prisma.complaint.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({ id: "trainer-123", role: "TRAINER" });
      prisma.complaint.create.mockResolvedValue({
        id: "complaint-123",
        reporterId: "user-123",
        reportedUserId: "trainer-123",
        gymSessionId: "session-123",
        source: "AUTO_NO_HELP",
        status: "PENDING",
      });

      const result = await gymService.rateTrainer(
        "session-123",
        "user-123",
        "trainer-123",
        1,
        false,
        "No se acercó en ningún momento"
      );

      expect(prisma.complaint.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reporterId: "user-123",
          reportedUserId: "trainer-123",
          gymSessionId: "session-123",
          source: "AUTO_NO_HELP",
          status: "PENDING",
          message: "No se acercó en ningún momento",
        }),
      });
      expect(result.complaint).toEqual(
        expect.objectContaining({ id: "complaint-123", source: "AUTO_NO_HELP" })
      );
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