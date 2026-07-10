import { describe, it, expect } from "vitest";
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
  });
});
