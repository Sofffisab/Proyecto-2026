import { describe, it, expect, afterEach, vi } from "vitest";
import { pseudonymizeId, shapeUserForAnalytics } from "../../../src/utils/privacy.js";

describe("privacy utils", () => {
  describe("pseudonymizeId", () => {
    it("is stable for the same userId", () => {
      const a = pseudonymizeId("user-123");
      const b = pseudonymizeId("user-123");

      expect(a).toBe(b);
    });

    it("differs for different userIds", () => {
      const a = pseudonymizeId("user-123");
      const b = pseudonymizeId("user-456");

      expect(a).not.toBe(b);
    });

    it("does not leak the original userId in the output", () => {
      const pseudo = pseudonymizeId("user-123");

      expect(pseudo).not.toContain("user-123");
    });
  });

  describe("shapeUserForAnalytics", () => {
    const baseUser = {
      id: "user-123",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    };

    it("never includes identifiers when includeIdentifiers is not requested", () => {
      const shaped = shapeUserForAnalytics(baseUser);

      expect(shaped).not.toHaveProperty("email");
      expect(shaped).not.toHaveProperty("name");
      expect(shaped).not.toHaveProperty("userId");
      expect(shaped).toHaveProperty("pseudoId");
      expect(shaped.consented).toBe(true);
    });

    it("includes identifiers when requested and the user has consented", () => {
      const user = { ...baseUser, settings: { analyticsConsent: true } };
      const shaped = shapeUserForAnalytics(user, { includeIdentifiers: true });

      expect(shaped.userId).toBe("user-123");
      expect(shaped.name).toBe("Ada Lovelace");
      expect(shaped.email).toBe("ada@example.com");
    });

    it("treats a user with no settings object as consented by default", () => {
      const shaped = shapeUserForAnalytics(baseUser, { includeIdentifiers: true });

      expect(shaped.consented).toBe(true);
      expect(shaped.userId).toBe("user-123");
    });

    it("never attaches identifiers when consent was withdrawn, even if requested", () => {
      const user = { ...baseUser, settings: { analyticsConsent: false } };
      const shaped = shapeUserForAnalytics(user, { includeIdentifiers: true });

      expect(shaped.consented).toBe(false);
      expect(shaped).not.toHaveProperty("email");
      expect(shaped).not.toHaveProperty("name");
      expect(shaped).not.toHaveProperty("userId");
      expect(shaped).toHaveProperty("pseudoId");
    });

    it("the pseudoId matches pseudonymizeId(user.id) so records stay correlatable", () => {
      const shaped = shapeUserForAnalytics(baseUser);

      expect(shaped.pseudoId).toBe(pseudonymizeId(baseUser.id));
    });

    it("falls back to empty-string name parts when firstName/lastName are missing", () => {
      const user = { id: "user-123", email: "ada@example.com" };
      const shaped = shapeUserForAnalytics(user, { includeIdentifiers: true });

      expect(shaped.name).toBe("");
    });

    it("falls back to null email when the user has no email", () => {
      const user = { id: "user-123", firstName: "Ada", lastName: "Lovelace" };
      const shaped = shapeUserForAnalytics(user, { includeIdentifiers: true });

      expect(shaped.email).toBeNull();
    });
  });

  describe("PSEUDONYM_SECRET selection", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("prefers ANALYTICS_PSEUDONYMIZATION_SECRET over JWT_ACCESS_SECRET when both are set", async () => {
      vi.resetModules();
      vi.stubEnv("ANALYTICS_PSEUDONYMIZATION_SECRET", "dedicated-analytics-secret");
      vi.stubEnv("JWT_ACCESS_SECRET", "unrelated-jwt-secret");

      const { pseudonymizeId: pseudonymizeIdWithDedicatedSecret } = await import(
        "../../../src/utils/privacy.js?dedicated-secret"
      );

      vi.resetModules();
      vi.unstubAllEnvs();
      delete process.env.ANALYTICS_PSEUDONYMIZATION_SECRET;
      vi.stubEnv("JWT_ACCESS_SECRET", "unrelated-jwt-secret");

      const { pseudonymizeId: pseudonymizeIdWithJwtSecretOnly } = await import(
        "../../../src/utils/privacy.js?jwt-secret-only"
      );

      // Same userId, different underlying secret => different pseudonym.
      expect(pseudonymizeIdWithDedicatedSecret("user-123")).not.toBe(
        pseudonymizeIdWithJwtSecretOnly("user-123")
      );
    });

    it("falls back to the hardcoded insecure-dev-only secret when NEITHER env var is set", async () => {
      vi.resetModules();
      delete process.env.ANALYTICS_PSEUDONYMIZATION_SECRET;
      delete process.env.JWT_ACCESS_SECRET;

      const { pseudonymizeId: pseudonymizeIdWithNoSecretConfigured } = await import(
        "../../../src/utils/privacy.js?no-secret-configured"
      );

      // Compute what the output WOULD be if the module used the known
      // hardcoded fallback string as the HMAC key, and assert the module's
      // real output matches it exactly — i.e. it really did fall all the
      // way through to that last branch, not just "produced some value".
      const crypto = await import("crypto");
      const expected = crypto
        .createHmac("sha256", "insecure-dev-only-secret-change-me")
        .update("user-123")
        .digest("hex")
        .slice(0, 24);

      expect(pseudonymizeIdWithNoSecretConfigured("user-123")).toBe(expected);
    });

    it("uses JWT_ACCESS_SECRET when ANALYTICS_PSEUDONYMIZATION_SECRET is unset but JWT_ACCESS_SECRET IS set", async () => {
      vi.resetModules();
      delete process.env.ANALYTICS_PSEUDONYMIZATION_SECRET;
      vi.stubEnv("JWT_ACCESS_SECRET", "some-jwt-secret");

      const { pseudonymizeId: pseudonymizeIdWithJwtSecret } = await import(
        "../../../src/utils/privacy.js?jwt-secret-explicit"
      );

      const crypto = await import("crypto");
      const expected = crypto
        .createHmac("sha256", "some-jwt-secret")
        .update("user-123")
        .digest("hex")
        .slice(0, 24);

      expect(pseudonymizeIdWithJwtSecret("user-123")).toBe(expected);
    });
  });
});
