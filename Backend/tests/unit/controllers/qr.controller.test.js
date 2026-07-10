import { describe, it, expect, vi, beforeEach } from "vitest";
import * as qrController from "../../../src/controllers/qr.controller.js";
import * as verificationService from "../../../src/services/verification.service.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/services/verification.service.js");

describe("QrController", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      body: {},
      params: {},
      validatedData: {},
      user: { id: "user-123", role: "MEMBER" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  describe("generateQR", () => {
    it("returns the authenticated user's QR", async () => {
      const mockQR = { token: "abc123", expiresAt: new Date() };
      vi.spyOn(verificationService, "getUserQR").mockResolvedValue(mockQR);

      await qrController.generateQR(req, res, next);

      expect(verificationService.getUserQR).toHaveBeenCalledWith("user-123");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockQR });
    });

    it("calls next(err) if the service throws", async () => {
      const error = new Error("Database error");
      vi.spyOn(verificationService, "getUserQR").mockRejectedValue(error);

      await qrController.generateQR(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("validateQR", () => {
    it("processes a scanned QR payload", async () => {
      req.validatedData = { payload: "machine-qr-token" };
      const mockResult = { type: "MACHINE_USAGE_STARTED" };
      vi.spyOn(verificationService, "processScan").mockResolvedValue(mockResult);

      await qrController.validateQR(req, res, next);

      expect(verificationService.processScan).toHaveBeenCalledWith(
        "user-123",
        "machine-qr-token"
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("calls next(err) with an invalid/expired QR", async () => {
      req.validatedData = { payload: "expired-token" };
      const error = new Error("QR token expired");
      vi.spyOn(verificationService, "processScan").mockRejectedValue(error);

      await qrController.validateQR(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("getGymQRCodes", () => {
    it("returns all active machines ordered by creation date", async () => {
      const mockMachines = [{ id: "machine-1", name: "Treadmill 1", active: true }];
      prisma.machine.findMany.mockResolvedValue(mockMachines);

      await qrController.getGymQRCodes(req, res, next);

      expect(prisma.machine.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { createdAt: "desc" },
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockMachines });
    });

    it("calls next(err) if the database call fails", async () => {
      const error = new Error("Database error");
      prisma.machine.findMany.mockRejectedValue(error);

      await qrController.getGymQRCodes(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("regenerateMachine", () => {
    it("rotates the QR token for an existing machine", async () => {
      req.params = { id: "machine-1" };
      prisma.machine.findUnique.mockResolvedValue({ id: "machine-1", name: "Treadmill 1" });
      const mockResult = { id: "machine-1", qrToken: "new-token" };
      vi.spyOn(verificationService, "regenerateMachineQR").mockResolvedValue(mockResult);

      await qrController.regenerateMachine(req, res, next);

      expect(verificationService.regenerateMachineQR).toHaveBeenCalledWith("machine-1");
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockResult });
    });

    it("returns 404 when the machine doesn't exist", async () => {
      req.params = { id: "nonexistent" };
      prisma.machine.findUnique.mockResolvedValue(null);

      await qrController.regenerateMachine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Machine not found" });
      expect(verificationService.regenerateMachineQR).not.toHaveBeenCalled();
    });

    it("calls next(err) if the database call fails", async () => {
      req.params = { id: "machine-1" };
      const error = new Error("Database error");
      prisma.machine.findUnique.mockRejectedValue(error);

      await qrController.regenerateMachine(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("deactivateMachine", () => {
    it("deactivates an existing machine", async () => {
      req.params = { id: "machine-1" };
      prisma.machine.findUnique.mockResolvedValue({ id: "machine-1", name: "Treadmill 1" });
      const mockUpdated = { id: "machine-1", active: false };
      prisma.machine.update.mockResolvedValue(mockUpdated);

      await qrController.deactivateMachine(req, res, next);

      expect(prisma.machine.update).toHaveBeenCalledWith({
        where: { id: "machine-1" },
        data: { active: false },
      });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockUpdated });
    });

    it("returns 404 when the machine doesn't exist", async () => {
      req.params = { id: "nonexistent" };
      prisma.machine.findUnique.mockResolvedValue(null);

      await qrController.deactivateMachine(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Machine not found" });
      expect(prisma.machine.update).not.toHaveBeenCalled();
    });

    it("calls next(err) if the update fails", async () => {
      req.params = { id: "machine-1" };
      prisma.machine.findUnique.mockResolvedValue({ id: "machine-1" });
      const error = new Error("Database error");
      prisma.machine.update.mockRejectedValue(error);

      await qrController.deactivateMachine(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("createMachine", () => {
    it("creates a new machine with a generated QR token", async () => {
      req.validatedData = { name: "New Treadmill" };
      const mockMachine = { id: "machine-2", name: "New Treadmill", qrToken: "generated-token" };
      prisma.machine.create.mockResolvedValue(mockMachine);

      await qrController.createMachine(req, res, next);

      expect(prisma.machine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: "New Treadmill", qrToken: expect.any(String) }),
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockMachine });
    });

    it("calls next(err) if the creation fails", async () => {
      req.validatedData = { name: "New Treadmill" };
      const error = new Error("Database error");
      prisma.machine.create.mockRejectedValue(error);

      await qrController.createMachine(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
