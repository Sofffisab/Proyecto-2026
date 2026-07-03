import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateAnnualWrapped } from "../../../jobs/wrapped.job.js";
import { generateWrapped } from "../../../services/wrapped.service.js";
import prisma from "../../../config/prisma.js";

vi.mock("../../../config/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../services/wrapped.service.js", () => ({
  generateWrapped: vi.fn(),
}));

describe("generateAnnualWrapped", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("procesa solo usuarios con isActive:true", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "user-active" }]);
    generateWrapped.mockResolvedValue();

    await generateAnnualWrapped(2025);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
    });
    expect(generateWrapped).toHaveBeenCalledWith("user-active", 2025);
  });

  it("un fallo en un usuario no aborta el resto del batch", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "user-broken" }, { id: "user-ok" }]);
    
    generateWrapped
      .mockRejectedValueOnce(new Error("No data found for user"))
      .mockResolvedValueOnce();

    await expect(generateAnnualWrapped(2025)).resolves.not.toThrow();

    expect(generateWrapped).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[wrapped.job] Failed for user user-broken:")
    );
  });
});