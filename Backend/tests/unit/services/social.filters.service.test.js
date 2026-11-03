import { describe, it, expect } from "vitest";
import { canPair, satisfiesFilters } from "../../../src/services/social.service.js";

const person = (over = {}) => ({
  gender: "MALE",
  birthday: new Date("1995-06-15"),
  sameGenderOnly: false,
  sameAgeRangeOnly: false,
  ...over,
});

describe("social filters", () => {
  describe("satisfiesFilters (same gender)", () => {
    it("passes when the filter is off, whatever the genders are", () => {
      expect(satisfiesFilters(person(), person({ gender: "FEMALE" }))).toBe(true);
    });

    it("requires the same gender when on", () => {
      const me = person({ sameGenderOnly: true });
      expect(satisfiesFilters(me, person({ gender: "MALE" }))).toBe(true);
      expect(satisfiesFilters(me, person({ gender: "FEMALE" }))).toBe(false);
    });

    it("never matches people who did not say their gender", () => {
      const me = person({ sameGenderOnly: true });
      expect(satisfiesFilters(me, person({ gender: null }))).toBe(false);
      expect(satisfiesFilters(me, person({ gender: "PREFER_NOT_TO_SAY" }))).toBe(false);
      expect(
        satisfiesFilters(person({ sameGenderOnly: true, gender: "PREFER_NOT_TO_SAY" }), person({ gender: "PREFER_NOT_TO_SAY" }))
      ).toBe(false);
    });
  });

  describe("satisfiesFilters (age range)", () => {
    const now = new Date();
    const yearsAgo = (n) => new Date(Date.UTC(now.getUTCFullYear() - n, 0, 1));

    it("accepts people within the range (inclusive) and rejects the rest", () => {
      const me = person({ sameAgeRangeOnly: true, birthday: yearsAgo(30) });
      expect(satisfiesFilters(me, person({ birthday: yearsAgo(35) }), 5)).toBe(true);
      expect(satisfiesFilters(me, person({ birthday: yearsAgo(25) }), 5)).toBe(true);
      expect(satisfiesFilters(me, person({ birthday: yearsAgo(37) }), 5)).toBe(false);
    });

    it("rejects when either birthday is unknown", () => {
      const me = person({ sameAgeRangeOnly: true, birthday: yearsAgo(30) });
      expect(satisfiesFilters(me, person({ birthday: null }), 5)).toBe(false);
      expect(satisfiesFilters(person({ sameAgeRangeOnly: true, birthday: null }), person(), 5)).toBe(false);
    });
  });

  describe("canPair", () => {
    it("is mutual: B's filter also applies to A", () => {
      const a = person({ gender: "FEMALE" });
      const b = person({ gender: "MALE", sameGenderOnly: true });
      expect(canPair(a, b)).toBe(false);
      expect(canPair(b, a)).toBe(false);
    });

    it("is ruled out by a block, in any direction", () => {
      expect(canPair(person(), person(), { blocked: true })).toBe(false);
      expect(canPair(person(), person(), { blocked: false })).toBe(true);
    });

    it("pairs anyone when nobody set a filter", () => {
      expect(canPair(person({ gender: null, birthday: null }), person({ gender: "FEMALE" }))).toBe(true);
    });
  });
});
