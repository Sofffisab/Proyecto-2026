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

    it("rejects if only the second user has social challenges disabled", async () => {
      prisma.userSettings.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ disableSocial: true });

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

    it("rejects if only the second user does not have an active gym session", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst
        .mockResolvedValueOnce({ id: "session-a" })
        .mockResolvedValueOnce(null); // userB has no active session

      await expect(
        challengeService.assignChallenge("user-1", "user-2", "STATION_A")
      ).rejects.toThrow("The second user does not have an active gym session");
    });

    it("rejects if either user opted out of machine tracking", async () => {
      prisma.userSettings.findUnique
        .mockResolvedValueOnce({ machineTrackingOptOut: true })
        .mockResolvedValueOnce(null);

      await expect(
        challengeService.assignChallenge("user-1", "user-2", "STATION_A")
      ).rejects.toThrow("machine tracking disabled");
    });

    it("rejects if only the second user opted out of machine tracking", async () => {
      prisma.userSettings.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ machineTrackingOptOut: true });

      await expect(
        challengeService.assignChallenge("user-1", "user-2", "STATION_A")
      ).rejects.toThrow("machine tracking disabled");
    });

    it("rejects if either user is currently mid-exercise (active machine usage)", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session" });
      prisma.machineUsage.findFirst
        .mockResolvedValueOnce({ id: "usage-a" })
        .mockResolvedValueOnce(null);

      await expect(
        challengeService.assignChallenge("user-1", "user-2", "STATION_A")
      ).rejects.toThrow("mid-exercise");
    });

    it("rejects if only the second user is currently mid-exercise", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session" });
      prisma.machineUsage.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "usage-b" });

      await expect(
        challengeService.assignChallenge("user-1", "user-2", "STATION_A")
      ).rejects.toThrow("The second user is mid-exercise");
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
    it("throws 404 if the challenge does not exist", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue(null);

      await expect(challengeService.acceptChallenge("ghost", "user-2")).rejects.toThrow(
        "Challenge not found"
      );
    });

    it("throws if the challenge is not in the ASSIGNED state", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "c1",
        partnerUserId: "user-2",
        status: "ACCEPTED",
      });

      await expect(challengeService.acceptChallenge("c1", "user-2")).rejects.toThrow(
        "Challenge cannot be accepted in its current state"
      );
    });

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
    it("throws 404 if the challenge does not exist", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue(null);

      await expect(challengeService.rejectChallenge("ghost", "user-1")).rejects.toThrow(
        "Challenge not found"
      );
    });

    it("throws Forbidden if the caller is neither participant", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "c1",
        userId: "user-1",
        partnerUserId: "user-2",
        status: "ASSIGNED",
      });

      await expect(challengeService.rejectChallenge("c1", "user-3")).rejects.toThrow(
        "Forbidden"
      );
    });

    it("throws if the challenge is already resolved (not ASSIGNED/ACCEPTED)", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "c1",
        userId: "user-1",
        partnerUserId: "user-2",
        status: "COMPLETED",
      });

      await expect(challengeService.rejectChallenge("c1", "user-1")).rejects.toThrow(
        "Challenge cannot be cancelled in its current state"
      );
    });

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
    it("throws 404 if the challenge does not exist", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue(null);

      await expect(
        challengeService.completeChallengeByQR("ghost", "user-1", "user-2")
      ).rejects.toThrow("Challenge not found");
    });

    it("throws if the provided partnerId doesn't match this challenge's match-up", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "c1",
        userId: "user-1",
        partnerUserId: "user-2",
        status: "ACCEPTED",
      });

      await expect(
        challengeService.completeChallengeByQR("c1", "user-1", "someone-else")
      ).rejects.toThrow("Provided partnerId does not match this challenge match-up");
    });

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

    it("completes the challenge when the caller is the challenge's partner scanning the original requester's QR", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "challenge-1",
        userId: "user-1",
        partnerUserId: "user-2",
        status: "ACCEPTED",
      });
      prisma.socialChallenge.update.mockResolvedValue({ id: "challenge-1", status: "COMPLETED" });
      prisma.pointTransaction.create.mockResolvedValue({});
      prisma.socialInteraction.create.mockResolvedValue({});

      // callerId is the partner (user-2), scanning userId (user-1) — the
      // opposite direction from the previous test.
      const result = await challengeService.completeChallengeByQR(
        "challenge-1",
        "user-2",
        "user-1"
      );

      expect(result.status).toBe("COMPLETED");
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

    it("defaults station to null when none is provided and no existing challenge exists", async () => {
      prisma.userSettings.findUnique.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({ id: "session" });
      prisma.machineUsage.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.findFirst.mockResolvedValue(null);
      prisma.socialChallenge.create.mockResolvedValue({ id: "challenge-2", status: "ACCEPTED", station: null });

      await challengeService.pairFromScan("user-1", "user-2");

      expect(prisma.socialChallenge.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ station: null }) })
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

  describe("getActiveChallenges / getChallengeHistory / getSocialHistory aliases", () => {
    it("getActiveChallenges returns ASSIGNED/ACCEPTED challenges involving the user, either side", async () => {
      prisma.socialChallenge.findMany.mockResolvedValue([{ id: "c1" }]);

      const result = await challengeService.getActiveChallenges("user-1");

      expect(prisma.socialChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ userId: "user-1" }, { partnerUserId: "user-1" }],
            status: { in: ["ASSIGNED", "ACCEPTED"] },
          }),
        })
      );
      expect(result).toEqual([{ id: "c1" }]);
    });

    it("getActiveSocialChallenges is an alias for getActiveChallenges", async () => {
      prisma.socialChallenge.findMany.mockResolvedValue([{ id: "c1" }]);

      const result = await challengeService.getActiveSocialChallenges("user-1");

      expect(result).toEqual([{ id: "c1" }]);
    });

    it("getChallengeHistory returns every challenge regardless of status", async () => {
      prisma.socialChallenge.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);

      const result = await challengeService.getChallengeHistory("user-1");

      expect(prisma.socialChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ userId: "user-1" }, { partnerUserId: "user-1" }] },
        })
      );
      expect(result).toHaveLength(2);
    });

    it("getSocialHistory is an alias for getChallengeHistory", async () => {
      prisma.socialChallenge.findMany.mockResolvedValue([{ id: "c1" }]);

      const result = await challengeService.getSocialHistory("user-1");

      expect(result).toEqual([{ id: "c1" }]);
    });
  });

  describe("getChallengeById", () => {
    it("returns the challenge when the caller is a participant", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "c1",
        userId: "user-1",
        partnerUserId: "user-2",
      });

      const result = await challengeService.getChallengeById("c1", "user-1");

      expect(result.id).toBe("c1");
    });

    it("returns null when the challenge does not exist", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue(null);

      const result = await challengeService.getChallengeById("ghost", "user-1");

      expect(result).toBeNull();
    });

    it("throws Forbidden when the caller is not a participant", async () => {
      prisma.socialChallenge.findUnique.mockResolvedValue({
        id: "c1",
        userId: "user-1",
        partnerUserId: "user-2",
      });

      await expect(challengeService.getChallengeById("c1", "user-3")).rejects.toThrow(
        "Forbidden"
      );
    });
  });
});
