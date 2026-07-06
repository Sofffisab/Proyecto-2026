import { describe, it, expect, vi, beforeEach } from "vitest";
import { rotateMachineQRCodes } from "../../../src/jobs/qr.job.js";
import * as verificationService from "../../../src/services/verification.service.js";

vi.mock("../../../src/services/verification.service.js");

describe("rotateMachineQRCodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to regenerateAllMachineQRCodes and returns without error", async () => {
    verificationService.regenerateAllMachineQRCodes.mockResolvedValue({ regenerated: 12 });

    await expect(rotateMachineQRCodes()).resolves.toBeUndefined();

    expect(verificationService.regenerateAllMachineQRCodes).toHaveBeenCalledTimes(1);
  });

  it("propagates the error if regeneration fails, so the caller/cron sees the failure", async () => {
    verificationService.regenerateAllMachineQRCodes.mockRejectedValue(
      new Error("DB unavailable")
    );

    await expect(rotateMachineQRCodes()).rejects.toThrow("DB unavailable");
  });

  it("works correctly even when zero machines needed rotation", async () => {
    verificationService.regenerateAllMachineQRCodes.mockResolvedValue({ regenerated: 0 });

    await expect(rotateMachineQRCodes()).resolves.toBeUndefined();
  });
});
