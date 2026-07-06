import { describe, it, expect, vi, beforeEach } from "vitest";
import * as trainerMetricsService from "../../../src/services/trainerMetrics.service.js";
import prisma from "../../../src/config/prisma.js";

describe("TrainerMetricsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recalculates completed assistances, average rating and total ratings", async () => {
    prisma.assistance.count.mockResolvedValue(12);
    prisma.trainerRating.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 8 },
    });
    prisma.trainerProfile.upsert.mockResolvedValue({});

    const result = await trainerMetricsService.updateTrainerMetrics("trainer-1");

    expect(prisma.assistance.count).toHaveBeenCalledWith({
      where: { trainerId: "trainer-1", status: "COMPLETED" },
    });
    expect(result).toEqual({
      completedAssistances: 12,
      averageRating: 4.5,
      totalRatings: 8,
    });
  });

  it("defaults averageRating to 0 when the trainer has no ratings yet", async () => {
    prisma.assistance.count.mockResolvedValue(0);
    prisma.trainerRating.aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });
    prisma.trainerProfile.upsert.mockResolvedValue({});

    const result = await trainerMetricsService.updateTrainerMetrics("trainer-2");

    expect(result.averageRating).toBe(0);
    expect(result.totalRatings).toBe(0);
  });

  it("upserts the trainer profile with a default specialty on first creation", async () => {
    prisma.assistance.count.mockResolvedValue(1);
    prisma.trainerRating.aggregate.mockResolvedValue({
      _avg: { rating: 5 },
      _count: { rating: 1 },
    });
    prisma.trainerProfile.upsert.mockResolvedValue({});

    await trainerMetricsService.updateTrainerMetrics("trainer-3");

    expect(prisma.trainerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "trainer-3" },
        create: expect.objectContaining({
          userId: "trainer-3",
          specialties: ["GENERAL"],
        }),
      })
    );
  });
});
