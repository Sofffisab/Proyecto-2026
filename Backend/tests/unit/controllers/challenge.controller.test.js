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

    it("rejects a USER-type QR payload with no userId", async () => {
      req.validatedData = { payload: "malformed" };
      verificationService.validateQRPayload.mockReturnValue({ type: "USER" });

      await challengeController.scanUser(req, res, next);

      expect(challengeService.pairFromScan).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Missing userId") })
      );
    });
  });

  describe("getAll", () => {
    it("returns the caller's full challenge history", async () => {
      const mockData = [{ id: "challenge-1" }];
      challengeService.getChallengeHistory.mockResolvedValue(mockData);

      await challengeController.getAll(req, res, next);

      expect(challengeService.getChallengeHistory).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      challengeService.getChallengeHistory.mockRejectedValue(error);

      await challengeController.getAll(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getActive", () => {
    it("returns the caller's active social challenges", async () => {
      const mockData = [{ id: "challenge-1", status: "ACTIVE" }];
      challengeService.getActiveSocialChallenges.mockResolvedValue(mockData);

      await challengeController.getActive(req, res, next);

      expect(challengeService.getActiveSocialChallenges).toHaveBeenCalledWith("user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      const error = new Error("DB error");
      challengeService.getActiveSocialChallenges.mockRejectedValue(error);

      await challengeController.getActive(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getById", () => {
    it("returns 200 with the challenge when found", async () => {
      req.params = { id: "challenge-1" };
      const mockChallenge = { id: "challenge-1" };
      challengeService.getChallengeById.mockResolvedValue(mockChallenge);

      await challengeController.getById(req, res, next);

      expect(challengeService.getChallengeById).toHaveBeenCalledWith("challenge-1", "user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockChallenge });
    });

    it("returns 404 when the challenge does not exist", async () => {
      req.params = { id: "does-not-exist" };
      challengeService.getChallengeById.mockResolvedValue(null);

      await challengeController.getById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Challenge not found" });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "challenge-1" };
      const error = new Error("DB error");
      challengeService.getChallengeById.mockRejectedValue(error);

      await challengeController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("joinChallenge", () => {
    it("accepts the challenge and returns 200", async () => {
      req.params = { id: "challenge-1" };
      const mockData = { id: "challenge-1", status: "ACCEPTED" };
      challengeService.acceptChallenge.mockResolvedValue(mockData);

      await challengeController.joinChallenge(req, res, next);

      expect(challengeService.acceptChallenge).toHaveBeenCalledWith("challenge-1", "user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "challenge-1" };
      const error = new Error("Already accepted");
      challengeService.acceptChallenge.mockRejectedValue(error);

      await challengeController.joinChallenge(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("complete", () => {
    it("completes the challenge via the partner's QR and returns 200", async () => {
      req.params = { id: "challenge-1" };
      req.validatedData = { partnerId: "user-2" };
      const mockData = { id: "challenge-1", status: "COMPLETED" };
      challengeService.completeChallengeByQR.mockResolvedValue(mockData);

      await challengeController.complete(req, res, next);

      expect(challengeService.completeChallengeByQR).toHaveBeenCalledWith(
        "challenge-1",
        "user-1",
        "user-2"
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "challenge-1" };
      req.validatedData = { partnerId: "user-2" };
      const error = new Error("Partner mismatch");
      challengeService.completeChallengeByQR.mockRejectedValue(error);

      await challengeController.complete(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("cancel", () => {
    it("rejects/cancels the challenge and returns 200", async () => {
      req.params = { id: "challenge-1" };
      const mockData = { id: "challenge-1", status: "REJECTED" };
      challengeService.rejectChallenge.mockResolvedValue(mockData);

      await challengeController.cancel(req, res, next);

      expect(challengeService.rejectChallenge).toHaveBeenCalledWith("challenge-1", "user-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it("calls next(err) on failure", async () => {
      req.params = { id: "challenge-1" };
      const error = new Error("DB error");
      challengeService.rejectChallenge.mockRejectedValue(error);

      await challengeController.cancel(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
