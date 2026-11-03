import { describe, it, expect } from "vitest";
import { updateProfileSchema, updateSettingsSchema, blockUserSchema } from "../../../src/validators/user.schemas.js";
import { checkoutFeedbackSchema } from "../../../src/validators/denuncia.schemas.js";

const ok = (schema, value) => schema.safeParse(value).success;
const MACHINE = "44444444-4444-4444-8444-444444444444";

describe("profile photo", () => {
  it("accepts a small image data URL and null (remove)", () => {
    expect(ok(updateProfileSchema, { profilePhoto: "data:image/jpeg;base64,/9j/4AAQ" + "A".repeat(5000) })).toBe(true);
    expect(ok(updateProfileSchema, { profilePhoto: null })).toBe(true);
  });
  it("rejects URLs, non-images and oversized payloads", () => {
    expect(ok(updateProfileSchema, { profilePhoto: "http://x/y.png" })).toBe(false);
    expect(ok(updateProfileSchema, { profilePhoto: "data:text/html;base64,AAAA" })).toBe(false);
    expect(ok(updateProfileSchema, { profilePhoto: "data:image/png;base64," + "A".repeat(1_500_000) })).toBe(false);
  });
});

describe("social settings + block", () => {
  it("accepts the new filters", () => {
    expect(ok(updateSettingsSchema, { socialSameGenderOnly: true, socialSameAgeRangeOnly: false })).toBe(true);
    expect(ok(updateSettingsSchema, { socialSameGenderOnly: "yes" })).toBe(false);
  });
  it("block needs a non-empty name", () => {
    expect(ok(blockUserSchema, { name: "Ana Gomez" })).toBe(true);
    expect(ok(blockUserSchema, { name: "  " })).toBe(false);
  });
});

describe("checkout feedback", () => {
  it("accepts a machine denuncia with its machineId, and a day rating alone", () => {
    expect(ok(checkoutFeedbackSchema, { dayRating: 5, denuncias: [{ type: "MACHINE_BROKEN", machineId: MACHINE }] })).toBe(true);
    expect(ok(checkoutFeedbackSchema, { dayRating: 3 })).toBe(true);
  });
  it("rejects a denuncia without a target, or a rating out of range", () => {
    expect(ok(checkoutFeedbackSchema, { denuncias: [{ type: "MACHINE_BROKEN" }] })).toBe(false);
    expect(ok(checkoutFeedbackSchema, { denuncias: [{ type: "MEMBER_MISCONDUCT" }] })).toBe(false);
    expect(ok(checkoutFeedbackSchema, { dayRating: 6 })).toBe(false);
  });
});
