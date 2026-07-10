import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { validateSchema } from "../../../src/validators/schemas.js";

describe("validateSchema middleware factory", () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("calls next() and attaches validatedData when the body is valid", () => {
    req.body = { name: "Ada", age: 30 };

    validateSchema(testSchema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.validatedData).toEqual({ name: "Ada", age: 30 });
  });

  it("responds 422 and does not call next() when the body is invalid", () => {
    req.body = { name: "", age: -5 };

    validateSchema(testSchema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Validation failed",
      })
    );
  });

  it("maps each zod issue to a field + message pair", () => {
    req.body = { age: -5 }; // name missing, age invalid

    validateSchema(testSchema)(req, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name" }),
        expect.objectContaining({ field: "age" }),
      ])
    );
  });

  it("strips unknown fields from validatedData by default", () => {
    req.body = { name: "Ada", age: 30, isAdmin: true };

    validateSchema(testSchema)(req, res, next);

    expect(req.validatedData).not.toHaveProperty("isAdmin");
  });
});
