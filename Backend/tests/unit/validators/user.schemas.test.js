import { describe, it, expect } from "vitest";
import { updateUserSchema } from "../../../src/validators/user.schemas.js";

describe("updateUserSchema — perfil mínimo (pantalla U)", () => {
  it("accepts all 4 fields with valid fixed options", () => {
    const result = updateUserSchema.safeParse({
      objectives: ["LOSE_WEIGHT", "GAIN_MUSCLE"],
      trainingLevel: "INTERMEDIATE",
      weeklyTrainingDays: "FOUR",
      trainingType: "STRENGTH",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an objective outside the 4 fixed options", () => {
    const result = updateUserSchema.safeParse({ objectives: ["BECOME_A_BODYBUILDER"] });
    expect(result.success).toBe(false);
  });

  it("rejects a trainingLevel outside the 3 fixed options", () => {
    const result = updateUserSchema.safeParse({ trainingLevel: "EXPERT" });
    expect(result.success).toBe(false);
  });

  it("rejects a weeklyTrainingDays outside the 6 fixed options", () => {
    const result = updateUserSchema.safeParse({ weeklyTrainingDays: "EVERY_DAY" });
    expect(result.success).toBe(false);
  });

  it("rejects a trainingType outside the 4 fixed options", () => {
    const result = updateUserSchema.safeParse({ trainingType: "YOGA" });
    expect(result.success).toBe(false);
  });

  it("allows all 4 fields to be omitted (optional, filled in progressively)", () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
