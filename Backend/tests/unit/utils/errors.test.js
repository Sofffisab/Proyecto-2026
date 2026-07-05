import { describe, it, expect } from "vitest";
import { AppError } from "../../../src/utils/errors.js";

describe("AppError", () => {
  it("hereda de Error", () => {
    const error = new AppError("Test error", 400);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Test error");
  });

  it("asigna statusCode correctamente", () => {
    const error = new AppError("Unauthorized", 401);

    expect(error.statusCode).toBe(401);
  });

  it("default statusCode is 500", () => {
    const error = new AppError("Server error");

    expect(error.statusCode).toBe(500);
  });

  it("captures the stack trace correctly", () => {
    const error = new AppError("Test error", 400);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("AppError");
  });

  it("allows creating an error without a statusCode", () => {
    const error = new AppError("Generic error");

    expect(error.message).toBe("Generic error");
    expect(error.statusCode).toBe(500);
  });

  it("preserves the class name in toString", () => {
    const error = new AppError("Test error", 400);

    expect(error.toString()).toContain("AppError");
  });
});
