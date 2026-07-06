import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignRandomChallenges } from "../../../src/jobs/challenge.job.js";
import { assignChallenge } from "../../../src/services/challenge.service.js";
import { createNotification } from "../../../src/services/communication.service.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/config/prisma.js", () => ({
  default: {
    gymSession: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../src/services/challenge.service.js", () => ({
  assignChallenge: vi.fn(),
}));

vi.mock("../../../src/services/communication.service.js", () => ({
  createNotification: vi.fn(),
}));

describe("assignRandomChallenges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when fewer than 2 users are checked in", async () => {
    prisma.gymSession.findMany.mockResolvedValue([{ userId: "user-1" }]);

    const result = await assignRandomChallenges();

    expect(result).toEqual({ assigned: 0 });
    expect(assignChallenge).not.toHaveBeenCalled();
  });

  it("pairs up checked-in users and notifies both", async () => {
    prisma.gymSession.findMany.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    assignChallenge.mockResolvedValue({ id: "challenge-1" });
    createNotification.mockResolvedValue({});

    const result = await assignRandomChallenges();

    expect(result.assigned).toBe(1);
    expect(assignChallenge).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledTimes(2);
  });

  it("skips a pair that fails eligibility without aborting the whole run", async () => {
    prisma.gymSession.findMany.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    assignChallenge.mockRejectedValue(new Error("One or both users have social challenges disabled"));

    await expect(assignRandomChallenges()).resolves.toEqual({ assigned: 0 });
    expect(createNotification).not.toHaveBeenCalled();
  });
});
