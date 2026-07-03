import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import * as verificationService from "../../../src/services/verification.service.js";
import prisma from "../../../src/config/prisma.js";

describe("VerificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserQR", () => {
    it("genera payload firmado con HMAC-SHA256 usando QR_HMAC_SECRET", () => {
      const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || "test-secret";
      const payload = verificationService.getUserQR("user-123");

      expect(payload).toHaveProperty("type", "USER");
      expect(payload).toHaveProperty("userId", "user-123");
      expect(payload).toHaveProperty("ts");
      expect(payload).toHaveProperty("signature");
    });

    it("usa JWT_ACCESS_SECRET como fallback si no hay QR_HMAC_SECRET", () => {
      const originalSecret = process.env.QR_HMAC_SECRET;
      delete process.env.QR_HMAC_SECRET;

      const payload = verificationService.getUserQR("user-123");

      expect(payload).toHaveProperty("signature");

      process.env.QR_HMAC_SECRET = originalSecret;
    });
  });

  describe("validateQRPayload", () => {
    it("rechaza payload sin type", () => {
      const payload = { userId: "user-123", ts: Date.now() };

      expect(() => verificationService.validateQRPayload(payload)).toThrow("type");
    });

    it("rechaza firma HMAC inválida en tipo USER", () => {
      const payload = {
        type: "USER",
        userId: "user-123",
        ts: Date.now(),
        signature: "invalid_signature",
      };

      expect(() => verificationService.validateQRPayload(payload)).toThrow(
        "Invalid signature"
      );
    });

    it("rechaza si ts excede QR_TTL_MS (TTL vencido)", () => {
      const QR_TTL_MS = 5 * 60 * 1000; // 5 minutes
      const oldTimestamp = Date.now() - QR_TTL_MS - 1000; // 1 second past expiry

      const payload = {
        type: "USER",
        userId: "user-123",
        ts: oldTimestamp,
        signature: "valid_sig",
      };

      expect(() => verificationService.validateQRPayload(payload)).toThrow(
        "QR expired"
      );
    });

    it("acepta payload MACHINE sin validar HMAC (solo USER lo requiere)", () => {
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        ts: Date.now(),
      };

      const result = verificationService.validateQRPayload(payload);

      expect(result).toEqual(payload);
    });
  });

  describe("processScan", () => {
    it("tipo USER: requiere SocialChallenge ACCEPTED entre scanner y target", async () => {
      const payload = {
        type: "USER",
        userId: "target-user",
        ts: Date.now(),
      };

      prisma.socialChallenge.findFirst.mockResolvedValue(null);

      await expect(
        verificationService.processScan("scanner-user", payload)
      ).rejects.toThrow("No active challenge");
    });

    it("tipo USER: lanza error si no hay challenge activo", async () => {
      const payload = { type: "USER", userId: "target-user", ts: Date.now() };

      prisma.socialChallenge.findFirst.mockResolvedValue(null);

      await expect(
        verificationService.processScan("scanner-user", payload)
      ).rejects.toThrow();
    });

    it("tipo MACHINE: abre uso si no hay uno abierto (startedAt)", async () => {
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        ts: Date.now(),
      };

      prisma.machineUsage.findFirst.mockResolvedValue(null);
      prisma.machineUsage.create.mockResolvedValue({
        id: "usage-123",
        machineId: "machine-123",
        startedAt: new Date(),
        endedAt: null,
      });

      const result = await verificationService.processScan("user-123", payload);

      expect(result).toHaveProperty("startedAt");
      expect(result).not.toHaveProperty("endedAt");
    });

    it("tipo MACHINE: cierra uso abierto y calcula durationMinutes", async () => {
      const startTime = new Date(Date.now() - 30 * 60000); // 30 minutes ago
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        ts: Date.now(),
      };

      prisma.machineUsage.findFirst.mockResolvedValue({
        id: "usage-123",
        startedAt: startTime,
        endedAt: null,
      });

      prisma.machineUsage.update.mockResolvedValue({
        id: "usage-123",
        startedAt: startTime,
        endedAt: new Date(),
        durationMinutes: 30,
      });

      const result = await verificationService.processScan("user-123", payload);

      expect(result.durationMinutes).toBeGreaterThan(0);
      expect(result.endedAt).toBeDefined();
    });

    it("tipo MACHINE: rechaza si machine.qrToken no coincide", async () => {
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        qrToken: "wrong_token",
        ts: Date.now(),
      };

      prisma.machine.findUnique.mockResolvedValue({
        qrToken: "correct_token",
      });

      await expect(
        verificationService.processScan("user-123", payload)
      ).rejects.toThrow("Invalid machine token");
    });

    it("tipo MACHINE: asocia gymSessionId solo si hay sesión activa", async () => {
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        ts: Date.now(),
      };

      prisma.machineUsage.findFirst.mockResolvedValue(null);
      prisma.gymSession.findFirst.mockResolvedValue({
        id: "session-123",
        userId: "user-123",
      });

      prisma.machineUsage.create.mockResolvedValue({
        id: "usage-123",
        gymSessionId: "session-123",
      });

      const result = await verificationService.processScan("user-123", payload);

      expect(result).toBeDefined();
    });

    it("tipo ENTRY_EXIT: devuelve stub fijo (documentar que no tiene lógica real)", async () => {
      const payload = {
        type: "ENTRY_EXIT",
        ts: Date.now(),
      };

      const result = await verificationService.processScan("user-123", payload);

      expect(result).toEqual({ status: "stub", message: "ENTRY_EXIT not implemented" });
    });

    it("tipo desconocido: lanza error 'Unknown QR type'", async () => {
      const payload = {
        type: "UNKNOWN_TYPE",
        ts: Date.now(),
      };

      await expect(
        verificationService.processScan("user-123", payload)
      ).rejects.toThrow("Unknown QR type");
    });
  });
});
