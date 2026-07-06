import { describe, it, expect, vi, beforeEach } from "vitest";
import { enforceNoActiveChallengeForMachineUsage } from "../../../src/services/gymEnforcement.service.js";
import prisma from "../../../src/config/prisma.js";

describe("GymEnforcementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enforceNoActiveChallengeForMachineUsage", () => {
    it("resolves without throwing when the user has no active challenge", async () => {
      prisma.socialChallenge.findFirst.mockResolvedValue(null);

      await expect(
        enforceNoActiveChallengeForMachineUsage("user-1")
      ).resolves.toBeUndefined();
    });

    it("throws a 409 AppError naming the partner when the caller is the challenge owner", async () => {
      prisma.socialChallenge.findFirst.mockResolvedValue({
        userId: "user-1",
        partnerUserId: "user-2",
        user: { firstName: "John", lastName: "Doe" },
        partner: { firstName: "Jane", lastName: "Doe" },
      });

      const error = await enforceNoActiveChallengeForMachineUsage("user-1").catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(409);
      expect(error.message).toContain("Jane Doe");
    });

    it("throws naming the owner as the partner when the caller is the challenge partner", async () => {
      prisma.socialChallenge.findFirst.mockResolvedValue({
        userId: "user-2",
        partnerUserId: "user-1",
        user: { firstName: "Jane", lastName: "Doe" },
        partner: { firstName: "John", lastName: "Doe" },
      });

      const error = await enforceNoActiveChallengeForMachineUsage("user-1").catch((e) => e);

      expect(error.statusCode).toBe(409);
      expect(error.message).toContain("Jane Doe");
    });

    it("queries by ACCEPTED_BY_BOTH status for either side of the challenge", async () => {
      prisma.socialChallenge.findFirst.mockResolvedValue(null);

      await enforceNoActiveChallengeForMachineUsage("user-1");

      expect(prisma.socialChallenge.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ userId: "user-1" }, { partnerUserId: "user-1" }],
            status: "ACCEPTED_BY_BOTH",
          },
        })
      );
    });
  });
});
