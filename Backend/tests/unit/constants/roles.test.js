import { describe, it, expect } from "vitest";
import { ROLES, ROLE_LIST } from "../../../src/constants/roles.js";
import ROLES_DEFAULT from "../../../src/constants/roles.js";

describe("constants/roles.js", () => {
  it("defines exactly ADMIN, TRAINER, and USER", () => {
    expect(ROLES).toEqual({ ADMIN: "ADMIN", TRAINER: "TRAINER", USER: "USER" });
  });

  it("ROLE_LIST contains the values of ROLES, in the same order", () => {
    expect(ROLE_LIST).toEqual(["ADMIN", "TRAINER", "USER"]);
  });

  it("default export is the same object as the named ROLES export", () => {
    expect(ROLES_DEFAULT).toBe(ROLES);
  });
});
