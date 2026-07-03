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

  it("401 si no hay req.user", async () => {
    const middleware = authorize(["ADMIN"]);
    req.user = null;

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("403 si el rol del usuario no está en la lista permitida", async () => {
    const middleware = authorize(["ADMIN", "TRAINER"]);
    req.user = { id: "user-123", role: "USER" };

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("permite el paso si el rol está explícitamente en la lista", async () => {
    const middleware = authorize(["ADMIN", "TRAINER"]);
    req.user = { id: "user-123", role: "TRAINER" };

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("acepta arrays anidados gracias a .flat() — authorize(['ADMIN','TRAINER'])", async () => {
    const middleware = authorize([["ADMIN"], ["TRAINER"]]);
    req.user = { id: "user-123", role: "TRAINER" };

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("rechaza si el rol es inválido (no en base de datos)", async () => {
    const middleware = authorize(["ADMIN"]);
    req.user = { id: "user-123", role: "SUPERADMIN" }; // Invalid role

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("permite ADMIN cuando está en la lista", async () => {
    const middleware = authorize(["ADMIN"]);
    req.user = { id: "user-123", role: "ADMIN" };

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
