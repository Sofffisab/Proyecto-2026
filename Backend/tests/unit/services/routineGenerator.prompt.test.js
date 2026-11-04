import { describe, it, expect } from "vitest";
import { focusFromPrompt } from "../../../src/services/routineGenerator.service.js";

describe("focusFromPrompt", () => {
  it.each([
    ["día de piernas", "LEGS"],
    ["Quiero trabajar pecho y tríceps", "PUSH"],
    ["espalda", "PULL"],
    ["pecho y espalda", "UPPER"],
    ["tren superior", "UPPER"],
    ["cuerpo completo", "FULL"],
    ["leg day", "LEGS"],
    ["piernas y espalda y pecho", "FULL"],
  ])("%s -> %s", (text, focus) => {
    expect(focusFromPrompt(text)).toBe(focus);
  });

  it("returns null when the text says nothing known", () => {
    expect(focusFromPrompt("hola")).toBeNull();
    expect(focusFromPrompt("")).toBeNull();
    expect(focusFromPrompt(undefined)).toBeNull();
  });
});
