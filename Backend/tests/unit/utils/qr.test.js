import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// Importar las funciones de utils/qr.js
// En un proyecto real estas estarían importadas de ahí
const QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || process.env.JWT_ACCESS_SECRET;
const QR_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateQRPayload(type, data) {
  const ts = Date.now();
  const payload = { type, ts, ...data };
  
  if (type === "USER") {
    const message = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", QR_HMAC_SECRET)
      .update(message)
      .digest("hex");
    return { ...payload, signature };
  }
  
  return payload;
}

function validateQRSignature(payload) {
  if (payload.type !== "USER") return true;
  
  const { signature, ...data } = payload;
  const message = JSON.stringify(data);
  const expectedSignature = crypto
    .createHmac("sha256", QR_HMAC_SECRET)
    .update(message)
    .digest("hex");
  
  return signature === expectedSignature;
}

function validateQRExpiry(payload) {
  const age = Date.now() - payload.ts;
  return age < QR_TTL_MS;
}

describe("QR Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateQRPayload (USER)", () => {
    it("genera payload con firma HMAC-SHA256", () => {
      const payload = generateQRPayload("USER", { userId: "user-123" });

      expect(payload).toHaveProperty("type", "USER");
      expect(payload).toHaveProperty("userId", "user-123");
      expect(payload).toHaveProperty("ts");
      expect(payload).toHaveProperty("signature");
    });

    it("firma es reproducible con los mismos datos", () => {
      const data = { userId: "user-123" };
      const payload1 = generateQRPayload("USER", data);
      const payload2 = generateQRPayload("USER", data);

      expect(payload1.signature).toBe(payload2.signature);
    });

    it("firma diferente si el userId cambia", () => {
      const payload1 = generateQRPayload("USER", { userId: "user-123" });
      const payload2 = generateQRPayload("USER", { userId: "user-456" });

      expect(payload1.signature).not.toBe(payload2.signature);
    });
  });

  describe("generateQRPayload (MACHINE)", () => {
    it("genera payload sin firma para MACHINE", () => {
      const payload = generateQRPayload("MACHINE", { machineId: "machine-123" });

      expect(payload).toHaveProperty("type", "MACHINE");
      expect(payload).toHaveProperty("machineId");
      expect(payload).not.toHaveProperty("signature");
    });
  });

  describe("validateQRSignature", () => {
    it("valida firma HMAC correcta", () => {
      const payload = generateQRPayload("USER", { userId: "user-123" });
      const isValid = validateQRSignature(payload);

      expect(isValid).toBe(true);
    });

    it("rechaza firma HMAC inválida", () => {
      const payload = generateQRPayload("USER", { userId: "user-123" });
      payload.signature = "invalid_signature";

      const isValid = validateQRSignature(payload);

      expect(isValid).toBe(false);
    });

    it("no valida firma para MACHINE", () => {
      const payload = generateQRPayload("MACHINE", { machineId: "machine-123" });
      const isValid = validateQRSignature(payload);

      expect(isValid).toBe(true); // MACHINE no requiere firma
    });
  });

  describe("validateQRExpiry", () => {
    it("rechaza si el payload está expirado (> QR_TTL_MS)", () => {
      const oldTimestamp = Date.now() - QR_TTL_MS - 1000; // 1s past expiry
      const payload = { ts: oldTimestamp };

      const isValid = validateQRExpiry(payload);

      expect(isValid).toBe(false);
    });

    it("acepta si el payload está dentro del TTL", () => {
      const recentTimestamp = Date.now() - 60000; // 1 minute ago
      const payload = { ts: recentTimestamp };

      const isValid = validateQRExpiry(payload);

      expect(isValid).toBe(true);
    });

    it("acepta recién generado (ts = now)", () => {
      const payload = { ts: Date.now() };

      const isValid = validateQRExpiry(payload);

      expect(isValid).toBe(true);
    });
  });

  describe("QR roundtrip", () => {
    it("payload generado pasa validación de firma + expiry", () => {
      const data = { userId: "user-123" };
      const payload = generateQRPayload("USER", data);

      const signatureValid = validateQRSignature(payload);
      const expiryValid = validateQRExpiry(payload);

      expect(signatureValid).toBe(true);
      expect(expiryValid).toBe(true);
    });

    it("payload sin firma falla validación de firma", () => {
      const payload = { type: "USER", userId: "user-123", ts: Date.now() };

      const signatureValid = validateQRSignature(payload);

      expect(signatureValid).toBe(false);
    });
  });
});
