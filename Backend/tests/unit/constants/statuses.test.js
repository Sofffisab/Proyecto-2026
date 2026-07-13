import { describe, it, expect } from "vitest";
import {
  BASE_STATUSES,
  ASSISTANCE_STATUSES,
  ROUTINE_REQUEST_STATUSES,
  SOCIAL_CHALLENGE_STATUSES,
  COMPLAINT_STATUSES,
  REWARD_STATUSES,
} from "../../../src/constants/statuses.js";
import STATUSES_DEFAULT from "../../../src/constants/statuses.js";

describe("constants/statuses.js", () => {
  it("BASE_STATUSES has the six base lifecycle states", () => {
    expect(BASE_STATUSES).toEqual({
      PENDING: "PENDING",
      ASSIGNED: "ASSIGNED",
      ACCEPTED: "ACCEPTED",
      REJECTED: "REJECTED",
      COMPLETED: "COMPLETED",
      EXPIRED: "EXPIRED",
    });
  });

  it("ASSISTANCE_STATUSES only exposes PENDING/ASSIGNED/COMPLETED/EXPIRED", () => {
    expect(ASSISTANCE_STATUSES).toEqual({
      PENDING: "PENDING",
      ASSIGNED: "ASSIGNED",
      COMPLETED: "COMPLETED",
      EXPIRED: "EXPIRED",
    });
  });

  it("ROUTINE_REQUEST_STATUSES has no ASSIGNED/EXPIRED state", () => {
    expect(ROUTINE_REQUEST_STATUSES).toEqual({
      PENDING: "PENDING",
      ACCEPTED: "ACCEPTED",
      REJECTED: "REJECTED",
      COMPLETED: "COMPLETED",
    });
  });

  it("SOCIAL_CHALLENGE_STATUSES has no PENDING state", () => {
    expect(SOCIAL_CHALLENGE_STATUSES).toEqual({
      ASSIGNED: "ASSIGNED",
      ACCEPTED: "ACCEPTED",
      REJECTED: "REJECTED",
      COMPLETED: "COMPLETED",
      EXPIRED: "EXPIRED",
    });
  });

  it("COMPLAINT_STATUSES only has PENDING/APPROVED/REJECTED", () => {
    expect(COMPLAINT_STATUSES).toEqual({
      PENDING: "PENDING",
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
    });
  });

  it("REWARD_STATUSES tracks the shipping lifecycle", () => {
    expect(REWARD_STATUSES).toEqual({
      PENDING: "PENDING",
      APPROVED: "APPROVED",
      SHIPPED: "SHIPPED",
      DELIVERED: "DELIVERED",
    });
  });

  it("default export bundles all six status groups", () => {
    expect(STATUSES_DEFAULT).toEqual({
      BASE_STATUSES,
      ASSISTANCE_STATUSES,
      ROUTINE_REQUEST_STATUSES,
      SOCIAL_CHALLENGE_STATUSES,
      COMPLAINT_STATUSES,
      REWARD_STATUSES,
    });
  });
});
