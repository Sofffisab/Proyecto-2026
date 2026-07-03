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

  it("default statusCode es 500", () => {
    const error = new AppError("Server error");

    expect(error.statusCode).toBe(500);
  });

  it("captura el stack trace correctamente", () => {
    const error = new AppError("Test error", 400);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("AppError");
  });

  it("permite crear error sin statusCode", () => {
    const error = new AppError("Generic error");

    expect(error.message).toBe("Generic error");
    expect(error.statusCode).toBe(500);
  });

  it("preserva el nombre de la clase en toString", () => {
    const error = new AppError("Test error", 400);

    expect(error.toString()).toContain("AppError");
  });
});
