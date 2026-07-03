import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { errorHandler, notFoundHandler } from "../../../src/middlewares/error.middleware.js";
import { AppError } from "../../../src/utils/errors.js";

describe("errorHandler middleware", () => {
  let req, res, next;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {};
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("usa error.statusCode si existe, default 500", async () => {
    const error = new AppError("Bad request", 400);

    await errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("default 500 si no hay statusCode", async () => {
    const error = new Error("Generic error");

    await errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("oculta el mensaje real en errores 5xx ('Internal server error')", async () => {
    const error = new AppError("Database connection failed", 500);

    await errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Internal server error",
      })
    );
  });

  it("conserva el mensaje real en errores 4xx", async () => {
    const error = new AppError("Email already in use", 409);

    await errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Email already in use",
      })
    );
  });

  it("incluye stack solo si NODE_ENV !== 'production'", async () => {
    process.env.NODE_ENV = "development";
    const error = new AppError("Test error", 400);

    await errorHandler(error, req, res, next);

    const call = res.json.mock.calls[0][0];
    expect(call).toHaveProperty("stack");
  });

  it("no incluye stack en production", async () => {
    process.env.NODE_ENV = "production";
    const error = new AppError("Test error", 400);

    await errorHandler(error, req, res, next);

    const call = res.json.mock.calls[0][0];
    expect(call).not.toHaveProperty("stack");
  });
});

describe("notFoundHandler middleware", () => {
  let req, res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      method: "GET",
      path: "/nonexistent",
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it("devuelve 404 con success:false", async () => {
    await notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringContaining("not found"),
      })
    );
  });

  it("incluye el método y path en el mensaje", async () => {
    await notFoundHandler(req, res);

    const call = res.json.mock.calls[0][0];
    expect(call.message).toContain("GET");
    expect(call.message).toContain("/nonexistent");
  });
});
