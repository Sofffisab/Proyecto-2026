import { describe, it, expect, vi, beforeEach } from "vitest";
import * as wrappedService from "../../../src/services/wrapped.service.js";
import prisma from "../../../src/config/prisma.js";

describe("WrappedService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateWrapped", () => {
    function mockYearData({
      sessions = [],
      machines = [],
      pointsSum = 0,
      assistances = [],
      socialInteractions = [],
      trainerProfiles = [],
    } = {}) {
      prisma.gymSession.findMany.mockResolvedValue(sessions);
      prisma.machineUsage.findMany.mockResolvedValue(machines);
      prisma.pointTransaction.aggregate.mockResolvedValue({ _sum: { points: pointsSum } });
      prisma.assistance.findMany.mockResolvedValue(assistances);
      prisma.socialInteraction.findMany.mockResolvedValue(socialInteractions);
      prisma.user.findMany.mockResolvedValue(trainerProfiles);
      prisma.wrapped.upsert.mockImplementation(({ create }) => Promise.resolve(create));
    }

    it("aggregates totals, top machines and top trainers into a single payload", async () => {
      mockYearData({
        sessions: [{ durationMinutes: 30 }, { durationMinutes: 45 }],
        machines: [
          { machine: { name: "Treadmill" } },
          { machine: { name: "Treadmill" } },
          { machine: { name: "Bike" } },
        ],
        pointsSum: 500,
        assistances: [
          { trainerId: "trainer-1" },
          { trainerId: "trainer-1" },
          { trainerId: "trainer-2" },
        ],
        socialInteractions: [{}, {}],
        trainerProfiles: [
          { id: "trainer-1", firstName: "Ana", lastName: "Gomez" },
          { id: "trainer-2", firstName: "Bob", lastName: "Lee" },
        ],
      });

      const result = await wrappedService.generateWrapped("user-1", 2026);

      expect(result.totalSessions).toBe(2);
      expect(result.totalMinutes).toBe(75);
      expect(result.totalPoints).toBe(500);
      expect(result.assistancesReceived).toBe(3);
      expect(result.peopleMetCount).toBe(2);
      expect(result.machines[0]).toEqual({ name: "Treadmill", count: 2 });
      expect(result.topTrainers[0]).toEqual({
        trainerId: "trainer-1",
        name: "Ana Gomez",
        count: 2,
      });
    });

    it("defaults totalPoints to 0 when the aggregate sum is null", async () => {
      mockYearData({ pointsSum: null });

      const result = await wrappedService.generateWrapped("user-1", 2026);

      expect(result.totalPoints).toBe(0);
    });

    it("treats a session with a null/undefined durationMinutes (still open) as 0 when summing totalMinutes", async () => {
      mockYearData({ sessions: [{ durationMinutes: null }, { durationMinutes: 30 }] });

      const result = await wrappedService.generateWrapped("user-1", 2026);

      expect(result.totalMinutes).toBe(30);
    });

    it("labels a trainer as Unknown if their profile can't be resolved", async () => {
      mockYearData({
        assistances: [{ trainerId: "trainer-ghost" }],
        trainerProfiles: [], // lookup found nothing
      });

      const result = await wrappedService.generateWrapped("user-1", 2026);

      expect(result.topTrainers[0]).toEqual({
        trainerId: "trainer-ghost",
        name: "Unknown",
        count: 1,
      });
    });

    it("limits top machines and top trainers to 3", async () => {
      mockYearData({
        machines: [
          { machine: { name: "A" } },
          { machine: { name: "B" } },
          { machine: { name: "C" } },
          { machine: { name: "D" } },
        ],
        assistances: [
          { trainerId: "t1" },
          { trainerId: "t2" },
          { trainerId: "t3" },
          { trainerId: "t4" },
        ],
        trainerProfiles: [
          { id: "t1", firstName: "A", lastName: "A" },
          { id: "t2", firstName: "B", lastName: "B" },
          { id: "t3", firstName: "C", lastName: "C" },
        ],
      });

      const result = await wrappedService.generateWrapped("user-1", 2026);

      expect(result.machines).toHaveLength(3);
      expect(result.topTrainers).toHaveLength(3);
    });

    it("persists the payload via an upsert keyed by userId_year", async () => {
      mockYearData();

      await wrappedService.generateWrapped("user-1", 2026);

      expect(prisma.wrapped.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_year: { userId: "user-1", year: 2026 } },
        })
      );
    });

    it("scopes every query to the given year's date range", async () => {
      mockYearData();

      await wrappedService.generateWrapped("user-1", 2026);

      const yearStart = new Date(2026, 0, 1);
      const yearEnd = new Date(2027, 0, 1);

      expect(prisma.gymSession.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", checkInAt: { gte: yearStart, lt: yearEnd } },
      });
    });
  });

  describe("getWrapped", () => {
    it("returns the user's wrapped history ordered by most recent year", async () => {
      const wrappedList = [{ year: 2026 }, { year: 2025 }];
      prisma.wrapped.findMany.mockResolvedValue(wrappedList);

      const result = await wrappedService.getWrapped("user-1");

      expect(result).toEqual(wrappedList);
      expect(prisma.wrapped.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { year: "desc" },
      });
    });
  });
});
