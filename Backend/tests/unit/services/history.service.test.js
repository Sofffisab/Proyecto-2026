import { describe, it, expect, vi, beforeEach } from "vitest";
import * as historyService from "../../../src/services/history.service.js";
import prisma from "../../../src/config/prisma.js";

describe("HistoryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getInteractionHistory", () => {
    it("combines trainer assistances and social challenges sorted by most recent date", async () => {
      prisma.assistance.findMany.mockResolvedValue([
        {
          trainer: { id: "trainer-1", firstName: "Ana", lastName: "Gomez" },
          completedAt: new Date("2026-01-01"),
          machineId: "machine-1",
          machine: { name: "Treadmill" },
          trainerRating: 5,
        },
      ]);
      prisma.socialChallenge.findMany.mockResolvedValue([
        {
          id: "challenge-1",
          userId: "user-1",
          partnerUserId: "user-2",
          user: { id: "user-1", firstName: "John", lastName: "Doe" },
          partner: { id: "user-2", firstName: "Jane", lastName: "Doe" },
          completedAt: new Date("2026-02-01"),
        },
      ]);

      const result = await historyService.getInteractionHistory("user-1");

      expect(result).toHaveLength(2);
      // Most recent (social challenge, Feb) comes first.
      expect(result[0].type).toBe("SOCIAL_CHALLENGE");
      expect(result[0].partnerName).toBe("Jane Doe");
      expect(result[1].type).toBe("TRAINER_ASSISTANCE");
      expect(result[1].partnerName).toBe("Ana Gomez");
    });

    it("resolves the challenge partner correctly when the caller is not the challenge owner", async () => {
      prisma.assistance.findMany.mockResolvedValue([]);
      prisma.socialChallenge.findMany.mockResolvedValue([
        {
          id: "challenge-1",
          userId: "other-user",
          partnerUserId: "user-1",
          user: { id: "other-user", firstName: "Owner", lastName: "User" },
          partner: { id: "user-1", firstName: "Me", lastName: "User" },
          completedAt: new Date("2026-02-01"),
        },
      ]);

      const result = await historyService.getInteractionHistory("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].partnerId).toBe("other-user");
      expect(result[0].partnerName).toBe("Owner User");
    });

    it("returns an empty array when there is no history", async () => {
      prisma.assistance.findMany.mockResolvedValue([]);
      prisma.socialChallenge.findMany.mockResolvedValue([]);

      const result = await historyService.getInteractionHistory("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("getDailyMachineUsageLog", () => {
    it("groups machine usages by day and computes total duration", async () => {
      prisma.machineUsage.findMany.mockResolvedValue([
        {
          startedAt: new Date("2026-01-02T10:00:00Z"),
          endedAt: new Date("2026-01-02T10:30:00Z"),
          durationMinutes: 30,
          machine: { id: "machine-1", name: "Treadmill" },
        },
        {
          startedAt: new Date("2026-01-02T11:00:00Z"),
          endedAt: new Date("2026-01-02T11:15:00Z"),
          durationMinutes: 15,
          machine: { id: "machine-2", name: "Bike" },
        },
        {
          startedAt: new Date("2026-01-01T09:00:00Z"),
          endedAt: new Date("2026-01-01T09:20:00Z"),
          durationMinutes: 20,
          machine: { id: "machine-1", name: "Treadmill" },
        },
      ]);

      const result = await historyService.getDailyMachineUsageLog("user-1");

      expect(result).toHaveLength(2);
      // Sorted by date descending -> Jan 2 first.
      expect(result[0].date).toBe("2026-01-02");
      expect(result[0].machinesUsed).toBe(2);
      expect(result[0].totalDurationMinutes).toBe(45);
      expect(result[1].date).toBe("2026-01-01");
      expect(result[1].totalDurationMinutes).toBe(20);
    });

    it("returns an empty array when the user has no machine usage", async () => {
      prisma.machineUsage.findMany.mockResolvedValue([]);

      const result = await historyService.getDailyMachineUsageLog("user-1");

      expect(result).toEqual([]);
    });

    it("treats a missing durationMinutes as 0 when summing", async () => {
      prisma.machineUsage.findMany.mockResolvedValue([
        {
          startedAt: new Date("2026-01-02T10:00:00Z"),
          endedAt: null,
          durationMinutes: null,
          machine: { id: "machine-1", name: "Treadmill" },
        },
      ]);

      const result = await historyService.getDailyMachineUsageLog("user-1");

      expect(result[0].totalDurationMinutes).toBe(0);
    });
  });

  describe("getTrainerAssistanceHistory", () => {
    it("maps completed assistances into the trainer-facing shape", async () => {
      prisma.assistance.findMany.mockResolvedValue([
        {
          id: "assistance-1",
          user: { id: "user-1", firstName: "John", lastName: "Doe" },
          machine: { id: "machine-1", name: "Treadmill" },
          completedAt: new Date("2026-01-01"),
          trainerRating: 4,
          requestedAt: new Date("2025-12-31"),
        },
      ]);

      const result = await historyService.getTrainerAssistanceHistory("trainer-1");

      expect(prisma.assistance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { trainerId: "trainer-1", status: "COMPLETED" },
        })
      );
      expect(result).toEqual([
        {
          assistanceId: "assistance-1",
          studentId: "user-1",
          studentName: "John Doe",
          machineId: "machine-1",
          machineName: "Treadmill",
          date: new Date("2026-01-01"),
          rating: 4,
          requestedAt: new Date("2025-12-31"),
        },
      ]);
    });

    it("falls back to null machine fields when the assistance has no machine", async () => {
      prisma.assistance.findMany.mockResolvedValue([
        {
          id: "assistance-1",
          user: { id: "user-1", firstName: "John", lastName: "Doe" },
          machine: null,
          completedAt: new Date("2026-01-01"),
          trainerRating: null,
          requestedAt: new Date("2025-12-31"),
        },
      ]);

      const result = await historyService.getTrainerAssistanceHistory("trainer-1");

      expect(result[0].machineId).toBeNull();
      expect(result[0].machineName).toBeNull();
    });
  });

  describe("userHasActiveChallenge", () => {
    it("returns the active challenge when one exists", async () => {
      const challenge = { id: "challenge-1", status: "ACCEPTED_BY_BOTH" };
      prisma.socialChallenge.findFirst.mockResolvedValue(challenge);

      const result = await historyService.userHasActiveChallenge("user-1");

      expect(result).toEqual(challenge);
    });

    it("returns null when there is no active challenge", async () => {
      prisma.socialChallenge.findFirst.mockResolvedValue(null);

      const result = await historyService.userHasActiveChallenge("user-1");

      expect(result).toBeNull();
    });
  });
});
