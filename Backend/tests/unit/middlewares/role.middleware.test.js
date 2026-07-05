import { describe, it, expect, vi, beforeEach } from "vitest";
import { authorize } from "../../../src/middlewares/role.middleware.js";

describe("authorize middleware", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      user: null,
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it("401 if there is no req.user", async () => {
    const middleware = authorize(["ADMIN"]);
    req.user = null;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("403 if the user's role is not in the allowed list", async () => {
    const middleware = authorize(["ADMIN", "TRAINER"]);
    req.user = { id: "user-123", role: "USER" };

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows the request through if the role is explicitly in the list", async () => {
    const middleware = authorize(["ADMIN", "TRAINER"]);
    req.user = { id: "user-123", role: "TRAINER" };

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("accepts nested arrays thanks to .flat() — authorize(['ADMIN','TRAINER'])", async () => {
    const middleware = authorize([["ADMIN"], ["TRAINER"]]);
    req.user = { id: "user-123", role: "TRAINER" };

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("rejects if the role is invalid (not in the database)", async () => {
    const middleware = authorize(["ADMIN"]);
    req.user = { id: "user-123", role: "SUPERADMIN" }; // Invalid role

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows ADMIN when it is in the list", async () => {
    const middleware = authorize(["ADMIN"]);
    req.user = { id: "user-123", role: "ADMIN" };

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
