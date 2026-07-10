import { describe, it, expect, vi, beforeEach } from "vitest";
import QRCode from "qrcode";
import {
  generateQrToken,
  generateQrImage,
  encodeQrPayload,
  decodeQrPayload,
} from "../../../src/utils/qr.js";

// generateQrImage's only real logic is the try/catch around the external
// `qrcode` library, so we mock the library itself (not our own code).
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

describe("QR Utils (src/utils/qr.js)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateQrToken", () => {
    it("returns a valid UUID v4 string", () => {
      const token = generateQrToken();

      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("returns a different token on each call", () => {
      const token1 = generateQrToken();
      const token2 = generateQrToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe("generateQrImage", () => {
    it("delegates to QRCode.toDataURL with the JSON-stringified payload", async () => {
      QRCode.toDataURL.mockResolvedValue("data:image/png;base64,fake");
      const payload = { type: "USER", userId: "user-1" };

      const result = await generateQrImage(payload);

      expect(QRCode.toDataURL).toHaveBeenCalledWith(JSON.stringify(payload));
      expect(result).toBe("data:image/png;base64,fake");
    });

    it("wraps and rethrows an error if the QR library fails", async () => {
      QRCode.toDataURL.mockRejectedValue(new Error("invalid input"));

      await expect(generateQrImage({ type: "USER" })).rejects.toThrow(
        "[QR Utils] Failed to generate QR Image: invalid input"
      );
    });
  });

  describe("encodeQrPayload", () => {
    it("serializes the payload to a JSON string", () => {
      const payload = { type: "MACHINE", machineId: "machine-1" };

      expect(encodeQrPayload(payload)).toBe(JSON.stringify(payload));
    });
  });

  describe("decodeQrPayload", () => {
    it("parses a valid JSON string back into an object", () => {
      const payload = { type: "MACHINE", machineId: "machine-1" };

      expect(decodeQrPayload(JSON.stringify(payload))).toEqual(payload);
    });

    it("returns null for malformed JSON instead of throwing", () => {
      expect(decodeQrPayload("{not-valid-json")).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(decodeQrPayload("")).toBeNull();
    });
  });

  describe("roundtrip", () => {
    it("encode -> decode returns an equivalent payload", () => {
      const payload = { type: "USER", userId: "user-1", ts: 1767225600000 };

      const decoded = decodeQrPayload(encodeQrPayload(payload));

      expect(decoded).toEqual(payload);
    });
  });
});
