import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma.js";
import * as communicationService from "../../../src/services/communication.service.js";
import * as gamificationService from "../../../src/services/gamification.service.js";
import * as complaintService from "../../../src/services/complaint.service.js";

vi.mock("../../../src/services/communication.service.js");
vi.mock("../../../src/services/gamification.service.js");
vi.mock("../../../src/services/complaint.service.js");
vi.mock("../../../src/realtime/ably.js", () => ({
  emitNotificationEvent: vi.fn(),
}));

// Imported after mocks so the module under test picks up the mocked deps.
const machineConflictService = await import("../../../src/services/machineConflict.service.js");

describe("machineConflict.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gamificationService.addPoints.mockResolvedValue({});
  });

  describe("flagMachineConflict", () => {
    it("returns the existing unresolved conflict instead of creating a duplicate", async () => {
      const existing = { id: "conflict-1", machineId: "machine-1", resolvedAt: null };
      prisma.machineConflict.findFirst.mockResolvedValue(existing);

      const result = await machineConflictService.flagMachineConflict({
        machineId: "machine-1",
        firstUsage: { userId: "user-1", id: "usage-1" },
        secondUsage: { userId: "user-2", id: "usage-2" },
      });

      expect(result).toBe(existing);
      expect(prisma.machineConflict.create).not.toHaveBeenCalled();
    });

    it("creates a new conflict and notifies every active trainer", async () => {
      prisma.machineConflict.findFirst.mockResolvedValue(null);
      const newConflict = { id: "conflict-2", machineId: "machine-1" };
      prisma.machineConflict.create.mockResolvedValue(newConflict);
      prisma.machine.findUnique.mockResolvedValue({ id: "machine-1", name: "Treadmill 1" });
      prisma.user.findMany.mockResolvedValue([{ id: "trainer-1" }, { id: "trainer-2" }]);
      prisma.machineConflict.update.mockResolvedValue({});
      communicationService.createNotification.mockResolvedValue({});

      const result = await machineConflictService.flagMachineConflict({
        machineId: "machine-1",
        firstUsage: { userId: "user-1", id: "usage-1" },
        secondUsage: { userId: "user-2", id: "usage-2" },
      });

      expect(prisma.machineConflict.create).toHaveBeenCalledWith({
        data: {
          machineId: "machine-1",
          firstUserId: "user-1",
          secondUserId: "user-2",
          firstUsageId: "usage-1",
          secondUsageId: "usage-2",
        },
      });
      expect(communicationService.createNotification).toHaveBeenCalledTimes(2);
      expect(prisma.machineConflict.update).toHaveBeenCalledWith({
        where: { id: "conflict-2" },
        data: { notifiedTrainers: true },
      });
      expect(result).toBe(newConflict);
    });

    it("still returns the created conflict even if notifying trainers fails", async () => {
      prisma.machineConflict.findFirst.mockResolvedValue(null);
      const newConflict = { id: "conflict-3", machineId: "machine-1" };
      prisma.machineConflict.create.mockResolvedValue(newConflict);
      prisma.machine.findUnique.mockRejectedValue(new Error("DB down"));

      const result = await machineConflictService.flagMachineConflict({
        machineId: "machine-1",
        firstUsage: { userId: "user-1", id: "usage-1" },
        secondUsage: { userId: "user-2", id: "usage-2" },
      });

      expect(result).toBe(newConflict);
    });

    it("does not mark notifiedTrainers when there are no active trainers", async () => {
      prisma.machineConflict.findFirst.mockResolvedValue(null);
      const newConflict = { id: "conflict-4", machineId: "machine-1" };
      prisma.machineConflict.create.mockResolvedValue(newConflict);
      prisma.machine.findUnique.mockResolvedValue({ id: "machine-1", name: "Treadmill 1" });
      prisma.user.findMany.mockResolvedValue([]);

      await machineConflictService.flagMachineConflict({
        machineId: "machine-1",
        firstUsage: { userId: "user-1", id: "usage-1" },
        secondUsage: { userId: "user-2", id: "usage-2" },
      });

      expect(prisma.machineConflict.update).not.toHaveBeenCalled();
    });

    it("still returns the created conflict if the realtime emit throws", async () => {
      const { emitNotificationEvent } = await import("../../../src/realtime/ably.js");
      emitNotificationEvent.mockImplementationOnce(() => {
        throw new Error("Ably down");
      });

      prisma.machineConflict.findFirst.mockResolvedValue(null);
      const newConflict = { id: "conflict-5", machineId: "machine-1" };
      prisma.machineConflict.create.mockResolvedValue(newConflict);
      prisma.machine.findUnique.mockResolvedValue({ id: "machine-1", name: "Treadmill 1" });
      prisma.user.findMany.mockResolvedValue([{ id: "trainer-1" }]);
      prisma.machineConflict.update.mockResolvedValue({});
      communicationService.createNotification.mockResolvedValue({});

      const result = await machineConflictService.flagMachineConflict({
        machineId: "machine-1",
        firstUsage: { userId: "user-1", id: "usage-1" },
        secondUsage: { userId: "user-2", id: "usage-2" },
      });

      expect(result).toBe(newConflict);
    });

    it("falls back to the raw machineId in the alert body when the machine lookup returns null", async () => {
      prisma.machineConflict.findFirst.mockResolvedValue(null);
      const newConflict2 = { id: "conflict-6", machineId: "machine-1" };
      prisma.machineConflict.create.mockResolvedValue(newConflict2);
      prisma.machine.findUnique.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([{ id: "trainer-1" }]);
      prisma.machineConflict.update.mockResolvedValue({});
      communicationService.createNotification.mockResolvedValue({});

      await machineConflictService.flagMachineConflict({
        machineId: "machine-1",
        firstUsage: { userId: "user-1", id: "usage-1" },
        secondUsage: { userId: "user-2", id: "usage-2" },
      });

      expect(communicationService.createNotification).toHaveBeenCalledWith(
        "trainer-1",
        expect.any(String),
        expect.stringContaining("machine-1")
      );
    });
  });

  describe("getPendingConflicts", () => {
    it("returns unresolved conflicts ordered by detection date", async () => {
      const mockConflicts = [{ id: "conflict-1" }];
      prisma.machineConflict.findMany.mockResolvedValue(mockConflicts);

      const result = await machineConflictService.getPendingConflicts();

      expect(prisma.machineConflict.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resolvedAt: null },
          orderBy: { detectedAt: "asc" },
        })
      );
      expect(result).toBe(mockConflicts);
    });
  });

  describe("resolveConflict", () => {
    it("throws if the conflict doesn't exist", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue(null);

      await expect(
        machineConflictService.resolveConflict("conflict-1", "trainer-1", "BOTH_PRESENT")
      ).rejects.toThrow("Machine conflict not found");
    });

    it("throws if the conflict was already resolved", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue({
        id: "conflict-1",
        resolvedAt: new Date(),
      });

      await expect(
        machineConflictService.resolveConflict("conflict-1", "trainer-1", "BOTH_PRESENT")
      ).rejects.toThrow("This conflict was already resolved");
    });

    it("leaves both usages open when resolution is BOTH_PRESENT", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue({
        id: "conflict-1",
        resolvedAt: null,
        firstUsageId: "usage-1",
        secondUsageId: "usage-2",
      });
      prisma.machineConflict.update.mockResolvedValue({ id: "conflict-1", resolution: "BOTH_PRESENT" });

      await machineConflictService.resolveConflict("conflict-1", "trainer-1", "BOTH_PRESENT");

      expect(prisma.machineUsage.update).not.toHaveBeenCalled();
    });

    it("closes both usages when resolution is NEITHER_PRESENT", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue({
        id: "conflict-1",
        resolvedAt: null,
        firstUsageId: "usage-1",
        secondUsageId: "usage-2",
      });
      prisma.machineUsage.findUnique
        .mockResolvedValueOnce({ id: "usage-1", endedAt: null })
        .mockResolvedValueOnce({ id: "usage-2", endedAt: null });
      prisma.machineConflict.update.mockResolvedValue({ id: "conflict-1" });

      await machineConflictService.resolveConflict("conflict-1", "trainer-1", "NEITHER_PRESENT");

      expect(prisma.machineUsage.update).toHaveBeenCalledTimes(2);
      expect(prisma.machineUsage.update).toHaveBeenCalledWith({
        where: { id: "usage-1" },
        data: expect.objectContaining({ durationMinutes: 0 }),
      });
    });

    it("closes only the second usage when resolution is ONLY_FIRST", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue({
        id: "conflict-1",
        resolvedAt: null,
        firstUsageId: "usage-1",
        secondUsageId: "usage-2",
      });
      prisma.machineUsage.findUnique.mockResolvedValue({ id: "usage-2", endedAt: null });
      prisma.machineConflict.update.mockResolvedValue({ id: "conflict-1" });

      await machineConflictService.resolveConflict("conflict-1", "trainer-1", "ONLY_FIRST");

      expect(prisma.machineUsage.update).toHaveBeenCalledTimes(1);
      expect(prisma.machineUsage.update).toHaveBeenCalledWith({
        where: { id: "usage-2" },
        data: expect.objectContaining({ durationMinutes: 0 }),
      });
    });

    it("does not close a usage that's already ended", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue({
        id: "conflict-1",
        resolvedAt: null,
        firstUsageId: "usage-1",
        secondUsageId: "usage-2",
      });
      prisma.machineUsage.findUnique.mockResolvedValue({ id: "usage-2", endedAt: new Date() });
      prisma.machineConflict.update.mockResolvedValue({ id: "conflict-1" });

      await machineConflictService.resolveConflict("conflict-1", "trainer-1", "ONLY_FIRST");

      expect(prisma.machineUsage.update).not.toHaveBeenCalled();
    });

    it("closes only the first usage when resolution is ONLY_SECOND", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue({
        id: "conflict-1",
        resolvedAt: null,
        firstUsageId: "usage-1",
        secondUsageId: "usage-2",
      });
      prisma.machineUsage.findUnique.mockResolvedValue({ id: "usage-1", endedAt: null });
      prisma.machineConflict.update.mockResolvedValue({ id: "conflict-1" });

      await machineConflictService.resolveConflict("conflict-1", "trainer-1", "ONLY_SECOND");

      expect(prisma.machineUsage.update).toHaveBeenCalledTimes(1);
      expect(prisma.machineUsage.update).toHaveBeenCalledWith({
        where: { id: "usage-1" },
        data: expect.objectContaining({ durationMinutes: 0 }),
      });
    });

    it("does not let a failed trainer order-bonus award break the resolution", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue({
        id: "conflict-1",
        resolvedAt: null,
        firstUsageId: "usage-1",
        secondUsageId: "usage-2",
      });
      prisma.machineConflict.update.mockResolvedValue({ id: "conflict-1" });
      gamificationService.addPoints.mockRejectedValueOnce(new Error("points service down"));

      const result = await machineConflictService.resolveConflict(
        "conflict-1",
        "trainer-1",
        "BOTH_PRESENT"
      );

      // Let the fire-and-forget addPoints().catch() microtask run.
      await new Promise((resolve) => setImmediate(resolve));

      expect(result).toEqual({ id: "conflict-1" });
    });

    it("awards the trainer order bonus after resolving", async () => {
      prisma.machineConflict.findUnique.mockResolvedValue({
        id: "conflict-1",
        resolvedAt: null,
        firstUsageId: "usage-1",
        secondUsageId: "usage-2",
      });
      prisma.machineConflict.update.mockResolvedValue({ id: "conflict-1" });

      await machineConflictService.resolveConflict("conflict-1", "trainer-1", "BOTH_PRESENT");

      expect(gamificationService.addPoints).toHaveBeenCalledWith(
        "trainer-1",
        5,
        "Verified a machine-usage conflict"
      );
    });
  });

  describe("expireUnverifiedConflicts", () => {
    it("returns expired: 0 when there's nothing stale", async () => {
      prisma.machineConflict.findMany.mockResolvedValue([]);

      const result = await machineConflictService.expireUnverifiedConflicts();

      expect(result).toEqual({ expired: 0 });
    });

    it("marks stale conflicts UNVERIFIED and raises mutual complaints", async () => {
      const staleConflict = {
        id: "conflict-1",
        firstUserId: "user-1",
        secondUserId: "user-2",
      };
      prisma.machineConflict.findMany.mockResolvedValue([staleConflict]);
      prisma.machineConflict.update.mockResolvedValue({});
      complaintService.createAutoMachineConflictComplaint.mockResolvedValue({});

      const result = await machineConflictService.expireUnverifiedConflicts();

      expect(prisma.machineConflict.update).toHaveBeenCalledWith({
        where: { id: "conflict-1" },
        data: expect.objectContaining({ resolution: "UNVERIFIED" }),
      });
      expect(complaintService.createAutoMachineConflictComplaint).toHaveBeenCalledTimes(2);
      expect(complaintService.createAutoMachineConflictComplaint).toHaveBeenCalledWith({
        reporterId: "user-2",
        reportedUserId: "user-1",
        conflictId: "conflict-1",
      });
      expect(complaintService.createAutoMachineConflictComplaint).toHaveBeenCalledWith({
        reporterId: "user-1",
        reportedUserId: "user-2",
        conflictId: "conflict-1",
      });
      expect(result).toEqual({ expired: 1 });
    });

    it("keeps processing remaining conflicts even if one fails", async () => {
      const conflictA = { id: "conflict-a", firstUserId: "u1", secondUserId: "u2" };
      const conflictB = { id: "conflict-b", firstUserId: "u3", secondUserId: "u4" };
      prisma.machineConflict.findMany.mockResolvedValue([conflictA, conflictB]);
      prisma.machineConflict.update
        .mockRejectedValueOnce(new Error("DB error"))
        .mockResolvedValueOnce({});
      complaintService.createAutoMachineConflictComplaint.mockResolvedValue({});

      const result = await machineConflictService.expireUnverifiedConflicts();

      expect(result).toEqual({ expired: 1 });
    });
  });
});
