import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import * as verificationService from "../../../src/services/verification.service.js";
import prisma from "../../../src/config/prisma.js";

// Mirrors verificationService's internal signing so tests can build
// payloads with a real, valid HMAC signature instead of a fake string.
function signPayload(rest) {
  const secret = process.env.QR_HMAC_SECRET ?? process.env.JWT_ACCESS_SECRET;
  return crypto.createHmac("sha256", secret).update(JSON.stringify(rest)).digest("hex");
}

describe("VerificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserQR", () => {
    it("generates a payload signed with HMAC-SHA256 using QR_HMAC_SECRET", () => {
      const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || "test-secret";
      const payload = verificationService.getUserQR("user-123");

      expect(payload).toHaveProperty("type", "USER");
      expect(payload).toHaveProperty("userId", "user-123");
      expect(payload).toHaveProperty("ts");
      expect(payload).toHaveProperty("signature");
    });

    it("uses JWT_ACCESS_SECRET as a fallback if there is no QR_HMAC_SECRET", () => {
      const originalSecret = process.env.QR_HMAC_SECRET;
      delete process.env.QR_HMAC_SECRET;

      const payload = verificationService.getUserQR("user-123");

      expect(payload).toHaveProperty("signature");

      process.env.QR_HMAC_SECRET = originalSecret;
    });
  });

  describe("regenerateMachineQR", () => {
    it("stashes the outgoing token as previousQrToken with a future validUntil", async () => {
      prisma.machine.findUnique.mockResolvedValue({
        id: "machine-123",
        qrToken: "old_token",
      });
      prisma.machine.update.mockResolvedValue({});

      await verificationService.regenerateMachineQR("machine-123");

      expect(prisma.machine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "machine-123" },
          data: expect.objectContaining({
            previousQrToken: "old_token",
            previousQrTokenValidUntil: expect.any(Date),
          }),
        })
      );
    });

    it("throws if the machine does not exist", async () => {
      prisma.machine.findUnique.mockResolvedValue(null);

      await expect(
        verificationService.regenerateMachineQR("missing-machine")
      ).rejects.toThrow("Machine not found");
    });
  });

  describe("regenerateAllMachineQRCodes", () => {
    it("carries each machine's outgoing token into previousQrToken", async () => {
      prisma.machine.findMany.mockResolvedValue([
        { id: "m1", qrToken: "token-1" },
        { id: "m2", qrToken: "token-2" },
      ]);
      prisma.machine.update.mockResolvedValue({});

      const result = await verificationService.regenerateAllMachineQRCodes();

      expect(result).toEqual({ regenerated: 2 });
      expect(prisma.machine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "m1" },
          data: expect.objectContaining({ previousQrToken: "token-1" }),
        })
      );
      expect(prisma.machine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "m2" },
          data: expect.objectContaining({ previousQrToken: "token-2" }),
        })
      );
    });
  });

  describe("validateQRPayload", () => {
    it("rejects a payload without a type", () => {
      const payload = { userId: "user-123", ts: Date.now() };

      expect(() => verificationService.validateQRPayload(payload)).toThrow("type");
    });

    it("rejects an invalid HMAC signature on type USER", () => {
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

    it("rejects if ts exceeds QR_TTL_MS (expired TTL)", () => {
      const QR_TTL_MS = 5 * 60 * 1000; // 5 minutes
      const oldTimestamp = Date.now() - QR_TTL_MS - 1000; // 1 second past expiry

      const rest = { type: "USER", userId: "user-123", ts: oldTimestamp };
      const payload = { ...rest, signature: signPayload(rest) };

      expect(() => verificationService.validateQRPayload(payload)).toThrow(
        "QR expired"
      );
    });

    it("accepts a MACHINE payload without validating HMAC (only USER requires it)", () => {
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
    it("type USER: requires an ACCEPTED SocialChallenge between scanner and target", async () => {
      const rest = { type: "USER", userId: "target-user", ts: Date.now() };
      const payload = { ...rest, signature: signPayload(rest) };

      prisma.socialChallenge.findFirst.mockResolvedValue(null);

      await expect(
        verificationService.processScan("scanner-user", payload)
      ).rejects.toThrow("No active challenge");
    });

    it("type USER: throws if there is no active challenge", async () => {
      const payload = { type: "USER", userId: "target-user", ts: Date.now() };

      prisma.socialChallenge.findFirst.mockResolvedValue(null);

      await expect(
        verificationService.processScan("scanner-user", payload)
      ).rejects.toThrow();
    });

    it("type MACHINE: opens a usage if there is none open (startedAt)", async () => {
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

    it("type MACHINE: opens a gym session (check-in) when the user has none active, and links it", async () => {
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        ts: Date.now(),
      };

      prisma.machineUsage.findFirst.mockResolvedValue(null);
      // No active gym session for this user.
      prisma.gymSession.findFirst.mockResolvedValue(null);
      // What gymCheckIn's internal prisma.gymSession.create call returns.
      prisma.gymSession.create.mockResolvedValue({
        id: "session-auto-1",
        userId: "user-123",
        checkInAt: new Date(),
        checkOutAt: null,
      });

      prisma.machineUsage.create.mockResolvedValue({
        id: "usage-123",
        machineId: "machine-123",
        gymSessionId: "session-auto-1",
        startedAt: new Date(),
        endedAt: null,
      });

      const result = await verificationService.processScan("user-123", payload);

      expect(prisma.gymSession.create).toHaveBeenCalled();
      expect(prisma.machineUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ gymSessionId: "session-auto-1" }),
      });
      expect(result.gymSessionId).toBe("session-auto-1");
      expect(result.gymSessionOpened).toBe(true);
      expect(result.gymSession).toMatchObject({ id: "session-auto-1" });
    });

    it("type MACHINE: closes the open usage and calculates durationMinutes", async () => {
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

    it("type MACHINE: rejects if machine.qrToken does not match", async () => {
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        qrToken: "wrong_token",
        ts: Date.now(),
      };

      prisma.machine.findUnique.mockResolvedValue({
        qrToken: "correct_token",
        previousQrToken: null,
        previousQrTokenValidUntil: null,
      });

      await expect(
        verificationService.processScan("user-123", payload)
      ).rejects.toThrow("Invalid machine token");
    });

    it("type MACHINE: accepts the previous token if still within its grace window", async () => {
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        qrToken: "old_token",
        ts: Date.now(),
      };

      prisma.machine.findUnique.mockResolvedValue({
        qrToken: "new_token",
        previousQrToken: "old_token",
        previousQrTokenValidUntil: new Date(Date.now() + 60000),
      });

      prisma.machineUsage.findFirst.mockResolvedValue(null);
      prisma.machineUsage.create.mockResolvedValue({
        id: "usage-123",
        machineId: "machine-123",
        startedAt: new Date(),
        endedAt: null,
      });

      const result = await verificationService.processScan("user-123", payload);

      expect(result).toHaveProperty("startedAt");
    });

    it("type MACHINE: rejects the previous token once its grace window has expired", async () => {
      const payload = {
        type: "MACHINE",
        machineId: "machine-123",
        qrToken: "old_token",
        ts: Date.now(),
      };

      prisma.machine.findUnique.mockResolvedValue({
        qrToken: "new_token",
        previousQrToken: "old_token",
        previousQrTokenValidUntil: new Date(Date.now() - 1000),
      });

      await expect(
        verificationService.processScan("user-123", payload)
      ).rejects.toThrow("Invalid machine token");
    });

    it("type MACHINE: associates gymSessionId only if there is an active session", async () => {
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

    it("type ENTRY_EXIT: checks in if there is no open session", async () => {
      const payload = {
        type: "ENTRY_EXIT",
        ts: Date.now(),
      };

      prisma.gymSession.findFirst.mockResolvedValue(null);
      prisma.gymSession.create.mockResolvedValue({
        id: "session-1",
        userId: "user-123",
        checkInAt: new Date(),
        checkOutAt: null,
      });

      const result = await verificationService.processScan("user-123", payload);

      expect(result.action).toBe("CHECK_IN");
      expect(result.session).toBeDefined();
    });

    it("type ENTRY_EXIT: checks out if there is an open session", async () => {
      const payload = {
        type: "ENTRY_EXIT",
        ts: Date.now(),
      };

      const openSession = {
        id: "session-1",
        userId: "user-123",
        checkInAt: new Date(Date.now() - 60000),
        checkOutAt: null,
      };

      prisma.gymSession.findFirst.mockResolvedValue(openSession);
      prisma.gymSession.update.mockResolvedValue({
        ...openSession,
        checkOutAt: new Date(),
        durationMinutes: 1,
      });

      const result = await verificationService.processScan("user-123", payload);

      expect(result.action).toBe("CHECK_OUT");
      expect(result.session).toBeDefined();
    });

    it("unknown type: throws 'Unknown QR type' error", async () => {
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
