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
  });
});
