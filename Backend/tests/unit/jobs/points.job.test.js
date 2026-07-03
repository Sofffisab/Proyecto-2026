import { describe, it, expect, vi, beforeEach } from "vitest";
import { recalculatePoints } from "../../../jobs/points.job.js";
import prisma from "../../../config/prisma.js";

// Mockear el cliente global de Prisma
vi.mock("../../../config/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
    },
    pointTransaction: {
      aggregate: vi.fn(),
    },
  },
}));

describe("recalculatePoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("agrega points por usuario vía prisma.pointTransaction.aggregate", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
    prisma.pointTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { points: 150 } })
      .mockResolvedValueOnce({ _sum: { points: null } }); // null produce 0 pts

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await recalculatePoints();

    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.pointTransaction.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.pointTransaction.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      _sum: { points: true },
    });

    expect(consoleSpy).anyLogsContain("[points.job] User user-1 total: 150 pts");
    expect(consoleSpy).anyLogsContain("[points.job] User user-2 total: 0 pts");
    consoleSpy.mockRestore();
  });

  it("un error en un usuario no corta el loop (processed/failed correctos)", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "user-1" }, { id: "user-2" }]);
    
    // El primero falla, el segundo tiene éxito
    prisma.pointTransaction.aggregate
      .mockRejectedValueOnce(new Error("DB Timeout"))
      .mockResolvedValueOnce({ _sum: { points: 50 } });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    await expect(recalculatePoints()).resolves.not.toThrow();

    expect(prisma.pointTransaction.aggregate).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[points.job] Failed to process user user-1:")
    );
    errorSpy.mockRestore();
  });

  it("propaga el error si falla el fetch inicial de usuarios", async () => {
    prisma.user.findMany.mockRejectedValue(new Error("Connection error"));

    await expect(recalculatePoints()).rejects.toThrow("Connection error");
  });
});

// Helper custom para aserciones de logs limpios
expect.extend({
  anyLogsContain(spy, expectedText) {
    const passed = spy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === "string" && arg.includes(expectedText))
    );
    return {
      pass: passed,
      message: () => `Expected logs to contain "${expectedText}"`,
    };
  },
});