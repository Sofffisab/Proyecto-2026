import { describe, it, expect, beforeEach, vi } from "vitest";
import * as challengeController from "../../../src/controllers/challenge.controller.js";
import * as challengeService from "../../../src/services/challenge.service.js";
import * as verificationService from "../../../src/services/verification.service.js";

vi.mock("../../../src/services/challenge.service.js");
vi.mock("../../../src/services/verification.service.js");

describe("ChallengeController", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { id: "user-1", role: "USER" },
      params: {},
      validatedData: {},
    };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe("scanUser", () => {
    it("validates the QR payload and pairs the two users instantly", async () => {
      req.validatedData = { payload: "raw-qr-string", station: "STATION_A" };
      verificationService.validateQRPayload.mockReturnValue({
        type: "USER",
        userId: "user-2",
        ts: Date.now(),
        signature: "sig",
      });
      const paired = { id: "challenge-1", status: "ACCEPTED" };
      challengeService.pairFromScan.mockResolvedValue(paired);

      await challengeController.scanUser(req, res, next);

      expect(verificationService.validateQRPayload).toHaveBeenCalledWith("raw-qr-string");
      expect(challengeService.pairFromScan).toHaveBeenCalledWith("user-1", "user-2", "STATION_A");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: paired });
    });

    it("rejects a QR payload that is not a USER-type code", async () => {
      req.validatedData = { payload: "machine-qr-string" };
      verificationService.validateQRPayload.mockReturnValue({ type: "MACHINE", machineId: "m-1" });

      await challengeController.scanUser(req, res, next);

      expect(challengeService.pairFromScan).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("does not belong to a user") })
      );
    });

    it("forwards invalid/expired signature errors from the QR validator to next()", async () => {
      req.validatedData = { payload: "tampered" };
      const error = new Error("Invalid signature");
      verificationService.validateQRPayload.mockImplementation(() => {
        throw error;
      });

      await challengeController.scanUser(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it("rejects a USER-type payload missing a userId", async () => {
      req.validatedData = { payload: "raw-qr-string" };
      verificationService.validateQRPayload.mockReturnValue({ type: "USER" });

      await challengeController.scanUser(req, res, next);

      expect(challengeService.pairFromScan).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Missing userId") })
      );
    });
  });

  describe("getAll", () => {
    it("returns the user's full challenge history", async () => {
      const mockData = [{ id: "c1" }];
      challengeService.getChallengeHistory.mockResolvedValue(mockData);

      await challengeController.getAll(req, res, next);

      expect(challengeService.getChallengeHistory).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      challengeService.getChallengeHistory.mockRejectedValue(error);

      await challengeController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getActive", () => {
    it("returns the user's active social challenges", async () => {
      const mockData = [{ id: "c1", status: "ACCEPTED" }];
      challengeService.getActiveSocialChallenges.mockResolvedValue(mockData);

      await challengeController.getActive(req, res, next);

      expect(challengeService.getActiveSocialChallenges).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      challengeService.getActiveSocialChallenges.mockRejectedValue(error);

      await challengeController.getActive(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getHistory", () => {
    it("returns the user's social history", async () => {
      const mockData = [{ id: "c1", status: "COMPLETED" }];
      challengeService.getSocialHistory.mockResolvedValue(mockData);

      await challengeController.getHistory(req, res, next);

      expect(challengeService.getSocialHistory).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      challengeService.getSocialHistory.mockRejectedValue(error);

      await challengeController.getHistory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getById", () => {
    it("returns the challenge when found", async () => {
      req.params.id = "c1";
      const mockChallenge = { id: "c1" };
      challengeService.getChallengeById.mockResolvedValue(mockChallenge);

      await challengeController.getById(req, res, next);

      expect(challengeService.getChallengeById).toHaveBeenCalledWith("c1", "user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockChallenge });
    });

    it("returns 404 when the challenge is not found", async () => {
      req.params.id = "missing";
      challengeService.getChallengeById.mockResolvedValue(null);

      await challengeController.getById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Challenge not found" });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      challengeService.getChallengeById.mockRejectedValue(error);

      await challengeController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("joinChallenge", () => {
    it("accepts the challenge on behalf of the user", async () => {
      req.params.id = "c1";
      const mockData = { id: "c1", status: "ACCEPTED" };
      challengeService.acceptChallenge.mockResolvedValue(mockData);

      await challengeController.joinChallenge(req, res, next);

      expect(challengeService.acceptChallenge).toHaveBeenCalledWith("c1", "user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      challengeService.acceptChallenge.mockRejectedValue(error);

      await challengeController.joinChallenge(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("complete", () => {
    it("completes the challenge via QR partner confirmation", async () => {
      req.params.id = "c1";
      req.validatedData = { partnerId: "partner-1" };
      const mockData = { id: "c1", status: "COMPLETED" };
      challengeService.completeChallengeByQR.mockResolvedValue(mockData);

      await challengeController.complete(req, res, next);

      expect(challengeService.completeChallengeByQR).toHaveBeenCalledWith(
        "c1",
        "user-1",
        "partner-1"
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      req.validatedData = { partnerId: "partner-1" };
      const error = new Error("boom");
      challengeService.completeChallengeByQR.mockRejectedValue(error);

      await challengeController.complete(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("cancel", () => {
    it("rejects/cancels the challenge", async () => {
      req.params.id = "c1";
      const mockData = { id: "c1", status: "CANCELLED" };
      challengeService.rejectChallenge.mockResolvedValue(mockData);

      await challengeController.cancel(req, res, next);

      expect(challengeService.rejectChallenge).toHaveBeenCalledWith("c1", "user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("boom");
      challengeService.rejectChallenge.mockRejectedValue(error);

      await challengeController.cancel(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("legacy aliases", () => {
    it("exports getActiveChallenges as an alias of getActive", () => {
      expect(challengeController.getActiveChallenges).toBe(challengeController.getActive);
    });

    it("exports getAllChallenges as an alias of getAll", () => {
      expect(challengeController.getAllChallenges).toBe(challengeController.getAll);
    });
  });
});
