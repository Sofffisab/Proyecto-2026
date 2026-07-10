import { describe, it, expect, vi, beforeEach } from "vitest";
import { processMachineConflicts } from "../../../src/jobs/machineConflicts.job.js";
import * as machineConflictService from "../../../src/services/machineConflict.service.js";

vi.mock("../../../src/services/machineConflict.service.js");

describe("processMachineConflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to expireUnverifiedConflicts and resolves without error", async () => {
    machineConflictService.expireUnverifiedConflicts.mockResolvedValue({ expired: 3 });

    await expect(processMachineConflicts()).resolves.toBeUndefined();

    expect(machineConflictService.expireUnverifiedConflicts).toHaveBeenCalledTimes(1);
  });

  it("works correctly when zero conflicts expired", async () => {
    machineConflictService.expireUnverifiedConflicts.mockResolvedValue({ expired: 0 });

    await expect(processMachineConflicts()).resolves.toBeUndefined();
  });

  it("propagates the error if expiring conflicts fails, so the caller/cron sees the failure", async () => {
    machineConflictService.expireUnverifiedConflicts.mockRejectedValue(
      new Error("DB unavailable")
    );

    await expect(processMachineConflicts()).rejects.toThrow("DB unavailable");
  });
});
