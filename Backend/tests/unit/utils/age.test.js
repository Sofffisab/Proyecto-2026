import { describe, it, expect } from "vitest";
import { calculateAge, isBirthdayToday } from "../../../src/utils/age.js";

describe("calculateAge", () => {
  it("returns null when there is no birthday", () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge(undefined)).toBeNull();
  });

  it("computes age when the birthday already happened this year", () => {
    const now = new Date("2026-07-07T12:00:00Z");
    expect(calculateAge(new Date("2000-01-15T00:00:00Z"), now)).toBe(26);
  });

  it("computes age when the birthday hasn't happened yet this year", () => {
    const now = new Date("2026-07-07T12:00:00Z");
    expect(calculateAge(new Date("2000-12-25T00:00:00Z"), now)).toBe(25);
  });

  it("increments the day after the birthday, without touching stored data", () => {
    const birthday = new Date("2000-07-07T00:00:00Z");
    expect(calculateAge(birthday, new Date("2026-07-06T12:00:00Z"))).toBe(25);
    expect(calculateAge(birthday, new Date("2026-07-07T12:00:00Z"))).toBe(26);
  });

  it("returns null when the birthday is an unparseable/corrupt value", () => {
    expect(calculateAge("not-a-date")).toBeNull();
    expect(calculateAge("2026-13-45")).toBeNull();
  });
});

describe("isBirthdayToday", () => {
  it("is false when there is no birthday", () => {
    expect(isBirthdayToday(null)).toBe(false);
  });

  it("is false when the birthday is an unparseable/corrupt value", () => {
    expect(isBirthdayToday("not-a-date")).toBe(false);
  });

  it("matches month/day regardless of birth year", () => {
    const today = new Date("2026-07-07T09:00:00Z");
    expect(isBirthdayToday(new Date("1995-07-07T00:00:00Z"), today)).toBe(true);
    expect(isBirthdayToday(new Date("1995-07-08T00:00:00Z"), today)).toBe(false);
  });

  it("treats Feb 29 birthdays as Feb 28 on non-leap years", () => {
    const nonLeapFeb28 = new Date("2026-02-28T09:00:00Z");
    expect(isBirthdayToday(new Date("2000-02-29T00:00:00Z"), nonLeapFeb28)).toBe(true);
  });

  it("matches Feb 29 exactly on leap years", () => {
    const leapFeb29 = new Date("2028-02-29T09:00:00Z");
    expect(isBirthdayToday(new Date("2000-02-29T00:00:00Z"), leapFeb29)).toBe(true);
  });
});
