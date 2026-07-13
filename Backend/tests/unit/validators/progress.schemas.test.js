import { describe, it, expect } from "vitest";
import {
  goalSchema,
  createChallengeSchema,
  syncActionsSchema,
  rateTrainerSchema,
  createTrainerComplaintSchema,
} from "../../../src/validators/progress.schemas.js";
import { COMPLAINT_REASON_CODES } from "../../../src/locales/es.js";

// This file does not re-test every field of every schema (that would just
// re-describe Zod itself). It focuses on the schemas that carry actual
// business rules: cross-field refinements, discriminated unions, and
// defaults, where a typo or regression would silently break behavior.

describe("progress.schemas", () => {
  describe("goalSchema", () => {
    it("accepts a valid goal", () => {
      const result = goalSchema.safeParse({
        objectiveAction: "GAIN",
        objectiveType: "MUSCLE",
        targetValue: 10,
      });

      expect(result.success).toBe(true);
    });

    it("rejects an objectiveType outside the allowed enum", () => {
      const result = goalSchema.safeParse({
        objectiveAction: "GAIN",
        objectiveType: "NOT_A_REAL_TYPE",
        targetValue: 10,
      });

      expect(result.success).toBe(false);
    });

    it("does not accept a client-provided difficulty (it's server-computed)", () => {
      const result = goalSchema.safeParse({
        objectiveAction: "GAIN",
        objectiveType: "MUSCLE",
        targetValue: 10,
        difficulty: "EASY",
      });

      // difficulty isn't part of the schema, so it's simply stripped, not
      // rejected — confirms the field can't be used to influence validation.
      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty("difficulty");
    });
  });

  describe("createChallengeSchema", () => {
    const userIdA = "11111111-1111-4111-8111-111111111111";
    const userIdB = "22222222-2222-4222-8222-222222222222";

    it("accepts a challenge between two different users", () => {
      const result = createChallengeSchema.safeParse({ userIdA, userIdB });

      expect(result.success).toBe(true);
    });

    it("rejects a user challenging themselves", () => {
      const result = createChallengeSchema.safeParse({ userIdA, userIdB: userIdA });

      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toEqual(["userIdB"]);
    });

    it("rejects non-uuid user ids", () => {
      const result = createChallengeSchema.safeParse({ userIdA: "not-a-uuid", userIdB });

      expect(result.success).toBe(false);
    });
  });

  describe("syncActionsSchema", () => {
    const ts = "2026-01-01T12:00:00.000Z";

    it("accepts a batch mixing every known action type", () => {
      const result = syncActionsSchema.safeParse({
        actions: [
          { type: "checkin", timestamp: ts },
          { type: "checkout", timestamp: ts },
          {
            type: "machineStart",
            timestamp: ts,
            payload: { machineId: "11111111-1111-4111-8111-111111111111" },
          },
          {
            type: "machineEnd",
            timestamp: ts,
            payload: { machineId: "11111111-1111-4111-8111-111111111111" },
          },
        ],
      });

      expect(result.success).toBe(true);
    });

    it("rejects an unknown action type via the discriminated union", () => {
      const result = syncActionsSchema.safeParse({
        actions: [{ type: "teleport", timestamp: ts }],
      });

      expect(result.success).toBe(false);
    });

    it("requires machineStart actions to include a machineId", () => {
      const result = syncActionsSchema.safeParse({
        actions: [{ type: "machineStart", timestamp: ts, payload: {} }],
      });

      expect(result.success).toBe(false);
    });

    it("rejects an empty actions array", () => {
      const result = syncActionsSchema.safeParse({ actions: [] });

      expect(result.success).toBe(false);
    });

    it("rejects a batch larger than 100 actions", () => {
      const actions = Array.from({ length: 101 }, () => ({ type: "checkin", timestamp: ts }));
      const result = syncActionsSchema.safeParse({ actions });

      expect(result.success).toBe(false);
    });

    it("accepts exactly 100 actions (boundary)", () => {
      const actions = Array.from({ length: 100 }, () => ({ type: "checkin", timestamp: ts }));
      const result = syncActionsSchema.safeParse({ actions });

      expect(result.success).toBe(true);
    });

    it("rejects a non-ISO timestamp", () => {
      const result = syncActionsSchema.safeParse({
        actions: [{ type: "checkin", timestamp: "not-a-date" }],
      });

      expect(result.success).toBe(false);
    });
  });

  describe("rateTrainerSchema", () => {
    const trainerId = "11111111-1111-4111-8111-111111111111";

    it("defaults helped to true when omitted", () => {
      const result = rateTrainerSchema.safeParse({ trainerId, rating: 5 });

      expect(result.success).toBe(true);
      expect(result.data.helped).toBe(true);
    });

    it("rejects a rating outside the 1-5 range", () => {
      const result = rateTrainerSchema.safeParse({ trainerId, rating: 6 });

      expect(result.success).toBe(false);
    });

    it("accepts helped: false together with a comment", () => {
      const result = rateTrainerSchema.safeParse({
        trainerId,
        rating: 2,
        helped: false,
        comment: "No pudo ayudarme con la rutina",
      });

      expect(result.success).toBe(true);
      expect(result.data.helped).toBe(false);
    });
  });

  describe("createTrainerComplaintSchema", () => {
    const reportedUserId = "22222222-2222-4222-8222-222222222222";

    it.each(Object.values(COMPLAINT_REASON_CODES))(
      "accepts %s as a valid reason code",
      (reason) => {
        const result = createTrainerComplaintSchema.safeParse({ reportedUserId, reason });
        expect(result.success).toBe(true);
      }
    );

    it("rejects a reason code that isn't in COMPLAINT_REASON_CODES", () => {
      const result = createTrainerComplaintSchema.safeParse({
        reportedUserId,
        reason: "SOMETHING_ELSE",
      });

      expect(result.success).toBe(false);
    });

    it("rejects the old Spanish enum values (no longer valid)", () => {
      const result = createTrainerComplaintSchema.safeParse({
        reportedUserId,
        reason: "DAÑO_DE_MAQUINA",
      });

      expect(result.success).toBe(false);
    });
  });
});
