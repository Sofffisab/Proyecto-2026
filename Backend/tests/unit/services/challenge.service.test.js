import { describe, it, expect, vi, beforeEach } from "vitest";
import * as challengeService from "../../../src/services/challenge.service.js";
import prisma from "../../../src/config/prisma.js";

describe("ChallengeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assignChallenge", () => {
    it("rejects a user challenging themselves", async () => {
      await expect(
        challengeService.assignChallenge("user-1", "user-1", "STATION_A")
      ).rejects.toThrow("A user cannot challenge themselves");
    });

    it("rejects if either user has social challenges disabled", async () => {
      prisma.userSettings.findUnique
        .mockResolvedValueOnce({ disableSocial: true })
        .mockResolvedValueOnce(null);

      await expect(
        challengeService.assignChallenge("user-1", "user-2", "STATION_A")
      ).rejects.toThrow("social challenges disabled");
    });

    it("rejects if either user does not have an active gym session", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst
        .mockResolvedValueOnce(null) // userA has no active session
        .mockResolvedValueOnce({ id: "session-b" });

      await expect(
        challengeService.assignChallenge("user-1", "user-2", "STATION_A")
      ).rejects.toThrow("does not have an active gym session");
    });

    it("creates an ASSIGNED challenge when both users are eligible", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session" });
      prisma.machineUsage.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.create.mockResolvedValue({ id: "challenge-1", status: "ASSIGNED" });

      const result = await challengeService.assignChallenge("user-1", "user-2", "STATION_A");

      expect(result.status).toBe("ASSIGNED");
    });

    it("rejects if an active challenge already exists between the two users", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session" });
      prisma.machineUsage.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.findFirst.mockResolvedValue({ id: "existing", status: "ASSIGNED" });

      await expect(
        challengeService.assignChallenge("user-1", "user-2", "STATION_A")
      ).rejects.toThrow("already exists");
    });
  });

  describe("acceptChallenge", () => {
    it("only the challenged partner can accept", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        partnerUserId: "user-2",
        status: "ASSIGNED",
      });

      await expect(challengeService.acceptChallenge("challenge-1", "user-3")).rejects.toThrow(
        "Only the challenged partner can accept"
      );
    });

    it("accepts a pending challenge for the correct partner", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        partnerUserId: "user-2",
        status: "ASSIGNED",
      });
      prisma.socialChallenge.update.mockResolvedValue({ id: "challenge-1", status: "ACCEPTED" });

      const result = await challengeService.acceptChallenge("challenge-1", "user-2");
      expect(result.status).toBe("ACCEPTED");
    });
  });

  describe("rejectChallenge", () => {
    it("awards consolation points to the partner if the assigner backs out after acceptance", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        userId: "user-1",
        partnerUserId: "user-2",
        status: "ACCEPTED",
      });
      prisma.socialChallenge.update.mockResolvedValue({ id: "challenge-1", status: "REJECTED" });
      prisma.pointTransaction.create.mockResolvedValue({});

      await challengeService.rejectChallenge("challenge-1", "user-1");

      expect(prisma.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: "user-2" }),
        })
      );
    });

    it("does not award points if the partner rejects their own acceptance", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        userId: "user-1",
        partnerUserId: "user-2",
        status: "ACCEPTED",
      });
      prisma.socialChallenge.update.mockResolvedValue({ id: "challenge-1", status: "REJECTED" });

      await challengeService.rejectChallenge("challenge-1", "user-2");

      expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe("completeChallengeByQR", () => {
    it("rejects if the challenge is not yet ACCEPTED", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        userId: "user-1",
        partnerUserId: "user-2",
        status: "ASSIGNED",
      });

      await expect(
        challengeService.completeChallengeByQR("challenge-1", "user-1", "user-2")
      ).rejects.toThrow("must be ACCEPTED");
    });

    it("completes the challenge and awards points to both users", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        userId: "user-1",
        partnerUserId: "user-2",
        status: "ACCEPTED",
      });
      prisma.socialChallenge.update.mockResolvedValue({ id: "challenge-1", status: "COMPLETED" });
      prisma.pointTransaction.create.mockResolvedValue({});
      prisma.socialInteraction.create.mockResolvedValue({});

      const result = await challengeService.completeChallengeByQR(
        "challenge-1",
        "user-1",
        "user-2"
      );

      expect(result.status).toBe("COMPLETED");
      expect(prisma.socialInteraction.create).toHaveBeenCalledTimes(2);
    });
  });

  describe("pairFromScan", () => {
    it("rejects a user scanning their own QR", async () => {
      await expect(
        challengeService.pairFromScan("user-1", "user-1", "STATION_A")
      ).rejects.toThrow("A user cannot challenge themselves");
    });

    it("creates an ACCEPTED challenge immediately when both users are eligible", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session" });
      prisma.machineUsage.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.create.mockResolvedValue({ id: "challenge-1", status: "ACCEPTED" });

      const result = await challengeService.pairFromScan("user-1", "user-2", "STATION_A");

      expect(result.status).toBe("ACCEPTED");
      expect(prisma.socialChallenge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            partnerUserId: "user-2",
            status: "ACCEPTED",
          }),
        })
      );
    });

    it("upgrades an existing ASSIGNED challenge to ACCEPTED instead of erroring", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session" });
      prisma.machineUsage.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.findFirst.mockResolvedValue({
        id: "challenge-1",
        userId: "user-2",
        partnerUserId: "user-1",
        status: "ASSIGNED",
      });
      prisma.socialChallenge.update.mockResolvedValue({ id: "challenge-1", status: "ACCEPTED" });

      const result = await challengeService.pairFromScan("user-1", "user-2");

      expect(prisma.socialChallenge.update).toHaveBeenCalledWith({
        where: { id: "challenge-1" },
        data: { status: "ACCEPTED" },
      });
      expect(result.status).toBe("ACCEPTED");
    });

    it("is idempotent: a duplicate scan of an already-ACCEPTED pair just returns it", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session" });
      prisma.machineUsage.findFirst.mockResolvedValue(null);
      const existing = { id: "challenge-1", userId: "user-1", partnerUserId: "user-2", status: "ACCEPTED" };
      prisma.socialChallenge.findFirst.mockResolvedValue(existing);

      const result = await challengeService.pairFromScan("user-1", "user-2");

      expect(prisma.socialChallenge.update).not.toHaveBeenCalled();
      expect(prisma.socialChallenge.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });
  });
});
