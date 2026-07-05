import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateAnnualWrapped } from "../../../src/jobs/wrapped.job.js";
import { generateWrapped } from "../../../src/services/wrapped.service.js";
import prisma from "../../../src/config/prisma.js";

vi.mock("../../../src/config/prisma.js", () => ({
  default: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../../src/services/wrapped.service.js", () => ({
  generateWrapped: vi.fn(),
}));

describe("generateAnnualWrapped", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("only processes users with isActive:true", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "user-active" }]);
    generateWrapped.mockResolvedValue();

    await generateAnnualWrapped(2025);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { id: true },
    });
    expect(generateWrapped).toHaveBeenCalledWith("user-active", 2025);
  });

  it("a failure for one user does not abort the rest of the batch", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "user-broken" }, { id: "user-ok" }]);
    
    generateWrapped
      .mockRejectedValueOnce(new Error("No data found for user"))
      .mockResolvedValueOnce();

    await expect(generateAnnualWrapped(2025)).resolves.not.toThrow();

    expect(generateWrapped).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[wrapped.job] Failed for user user-broken:"),
      expect.any(String)
    );
  });
});