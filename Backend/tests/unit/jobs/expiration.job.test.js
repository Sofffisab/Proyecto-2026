import { describe, it, expect, vi, beforeEach } from "vitest";
import { expireStaleEntities } from "../../../src/jobs/expiration.job.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/config/prisma.js", () => ({
  default: {
    gymSession: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    machineUsage: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    socialChallenge: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe("expireStaleEntities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    prisma.gymSession.findMany.mockResolvedValue([]);
    prisma.machineUsage.findMany.mockResolvedValue([]);
    prisma.socialChallenge.findMany.mockResolvedValue([]);
  });

  it("no hace nada si no hay entidades vencidas", async () => {
    await expireStaleEntities();

    expect(prisma.gymSession.update).not.toHaveBeenCalled();
    expect(prisma.machineUsage.update).not.toHaveBeenCalled();
    expect(prisma.socialChallenge.updateMany).not.toHaveBeenCalled();
  });

  it("auto-checkout de gymSessions abiertas hace más de AUTO_CHECKOUT_HOURS, marcadas autoClosed", async () => {
    const checkInAt = new Date(Date.now() - 5 * 60 * 60 * 1000);
    prisma.gymSession.findMany.mockResolvedValue([{ id: "session-1", checkInAt }]);
    prisma.gymSession.update.mockResolvedValue({});

    await expireStaleEntities();

    expect(prisma.gymSession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({ autoClosed: true }),
    });
  });

  it("cierra MachineUsage abandonados hace más de MACHINE_USAGE_TIMEOUT_HOURS", async () => {
    const startedAt = new Date(Date.now() - 4 * 60 * 60 * 1000);
    prisma.machineUsage.findMany.mockResolvedValue([{ id: "usage-1", startedAt }]);
    prisma.machineUsage.update.mockResolvedValue({});

    await expireStaleEntities();

    expect(prisma.machineUsage.update).toHaveBeenCalledWith({
      where: { id: "usage-1" },
      data: expect.objectContaining({ endedAt: expect.any(Date) }),
    });
  });

  it("expira SocialChallenges ASSIGNED/ACCEPTED cuyo expiresAt ya pasó", async () => {
    prisma.socialChallenge.findMany.mockResolvedValue([{ id: "challenge-1" }]);
    prisma.socialChallenge.updateMany.mockResolvedValue({ count: 1 });

    await expireStaleEntities();

    expect(prisma.socialChallenge.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["challenge-1"] } },
      data: { status: "EXPIRED" },
    });
  });
});
