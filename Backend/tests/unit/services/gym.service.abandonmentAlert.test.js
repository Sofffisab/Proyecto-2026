import { describe, it, expect, vi, beforeEach } from "vitest";
import * as gymService from "../../../src/services/gym.service.js";
import * as gamificationService from "../../../src/services/gamification.service.js";
import * as communicationService from "../../../src/services/communication.service.js";
import prisma from "../../../src/config/prisma.js";

// notifyAbandoningTrainersOnCheckIn() is NOT exported directly — it's fired
// (fire-and-forget) from inside checkIn() whenever alertNow is true (the
// default). These tests drive it through the public checkIn() API and flush
// the microtask queue, then assert on what it did/didn't tell
// communication.service to send.
//
// This covers src/services/gym.service.js lines ~129-184, which were
// previously untested: the "who gets alerted and why" business logic
// (ABANDONMENT_ALERT_THRESHOLD_DAYS comparison, disableAssistance opt-out,
// dedup of trainerPreference vs. past trainers, "never assisted" case).

vi.mock("../../../src/services/gamification.service.js");
vi.mock("../../../src/services/communication.service.js");

const ABANDONMENT_ALERT_THRESHOLD_DAYS = parseInt(
  process.env.ABANDONMENT_ALERT_THRESHOLD_DAYS ?? "14",
  10
);

async function flushMicrotasks() {
  // notifyAbandoningTrainersOnCheckIn is invoked with `.catch(...)` and not
  // awaited by checkIn(), so give its internal awaits a few ticks to settle
  // before asserting. It loops sequentially over N candidate trainers, and
  // each iteration does several awaits (findFirst, getUserCurrentLocation's
  // own two awaits, then notifyTrainerOfReturningStudent) — so with several
  // candidates this needs more than a handful of ticks. setImmediate lets
  // any pending I/O-queued mock resolutions flush too, not just microtasks.
  for (let i = 0; i < 50; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000);
}

describe("GymService — trainer abandonment alert (checkIn side-effect)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(gamificationService, "addPoints").mockResolvedValue(undefined);
    vi.spyOn(gamificationService, "checkAndUnlockAchievements").mockResolvedValue(undefined);
    vi.spyOn(communicationService, "notifyTrainerOfReturningStudent").mockResolvedValue(undefined);

    prisma.gymSession.findFirst.mockResolvedValue(null);
    prisma.gymSession.create.mockResolvedValue({
      id: "session-1",
      userId: "user-123",
      checkInAt: new Date(),
      checkOutAt: null,
    });

    // getUserCurrentLocation() dependencies — keep them simple/neutral for
    // these tests, which are about *whether* an alert fires, not the
    // location text.
    prisma.userSettings.findUnique.mockResolvedValue({ machineTrackingOptOut: false });
    prisma.machineUsage.findFirst.mockResolvedValue(null);
  });

  it("does NOT alert when the student has no preferred trainer and no past completed assistance", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: null, disableAssistance: false },
    });
    prisma.assistance.findMany.mockResolvedValue([]);

    await gymService.checkIn("user-123");
    await flushMicrotasks();

    expect(communicationService.notifyTrainerOfReturningStudent).not.toHaveBeenCalled();
  });

  it("does NOT alert when the student has disabled assistance", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: "trainer-1", disableAssistance: true },
    });

    await gymService.checkIn("user-123");
    await flushMicrotasks();

    expect(communicationService.notifyTrainerOfReturningStudent).not.toHaveBeenCalled();
    // Should bail out before even looking up past trainers.
    expect(prisma.assistance.findMany).not.toHaveBeenCalled();
  });

  it("alerts the preferred trainer when that trainer has NEVER completed an assistance with this student", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: "trainer-1", disableAssistance: false },
    });
    prisma.assistance.findMany.mockResolvedValue([]); // no past COMPLETED assistances at all
    prisma.assistance.findFirst.mockResolvedValue(null); // this trainer specifically: never

    await gymService.checkIn("user-123");
    await flushMicrotasks();

    expect(communicationService.notifyTrainerOfReturningStudent).toHaveBeenCalledTimes(1);
    const [trainerId, student, payload] =
      communicationService.notifyTrainerOfReturningStudent.mock.calls[0];
    expect(trainerId).toBe("trainer-1");
    expect(student.id).toBe("user-123");
    expect(payload.daysSinceLastAssistance).toBeNull();
  });

  it("does NOT alert a trainer who completed an assistance recently (below the threshold)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: null, disableAssistance: false },
    });
    prisma.assistance.findMany.mockResolvedValue([{ trainerId: "trainer-2" }]);
    prisma.assistance.findFirst.mockResolvedValue({
      completedAt: daysAgo(ABANDONMENT_ALERT_THRESHOLD_DAYS - 5),
    });

    await gymService.checkIn("user-123");
    await flushMicrotasks();

    expect(communicationService.notifyTrainerOfReturningStudent).not.toHaveBeenCalled();
  });

  it("alerts a trainer whose last completed assistance is exactly at the threshold", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: null, disableAssistance: false },
    });
    prisma.assistance.findMany.mockResolvedValue([{ trainerId: "trainer-2" }]);
    prisma.assistance.findFirst.mockResolvedValue({
      completedAt: daysAgo(ABANDONMENT_ALERT_THRESHOLD_DAYS),
    });

    await gymService.checkIn("user-123");
    await flushMicrotasks();

    expect(communicationService.notifyTrainerOfReturningStudent).toHaveBeenCalledTimes(1);
    const [trainerId, , payload] =
      communicationService.notifyTrainerOfReturningStudent.mock.calls[0];
    expect(trainerId).toBe("trainer-2");
    expect(payload.daysSinceLastAssistance).toBeGreaterThanOrEqual(
      ABANDONMENT_ALERT_THRESHOLD_DAYS
    );
  });

  it("alerts a trainer whose last completed assistance is well past the threshold", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: null, disableAssistance: false },
    });
    prisma.assistance.findMany.mockResolvedValue([{ trainerId: "trainer-2" }]);
    prisma.assistance.findFirst.mockResolvedValue({
      completedAt: daysAgo(ABANDONMENT_ALERT_THRESHOLD_DAYS + 30),
    });

    await gymService.checkIn("user-123");
    await flushMicrotasks();

    expect(communicationService.notifyTrainerOfReturningStudent).toHaveBeenCalledTimes(1);
  });

  it("de-duplicates the preferred trainer against the past-trainers list (only one alert)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: "trainer-1", disableAssistance: false },
    });
    // trainer-1 is both the preference AND shows up as a past trainer.
    prisma.assistance.findMany.mockResolvedValue([{ trainerId: "trainer-1" }]);
    prisma.assistance.findFirst.mockResolvedValue({
      completedAt: daysAgo(ABANDONMENT_ALERT_THRESHOLD_DAYS + 1),
    });

    await gymService.checkIn("user-123");
    await flushMicrotasks();

    expect(communicationService.notifyTrainerOfReturningStudent).toHaveBeenCalledTimes(1);
  });

  it("alerts each overdue trainer independently when there are multiple candidates", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: "trainer-1", disableAssistance: false },
    });
    prisma.assistance.findMany.mockResolvedValue([
      { trainerId: "trainer-2" },
      { trainerId: "trainer-3" },
    ]);

    prisma.assistance.findFirst.mockImplementation(({ where }) => {
      if (where.trainerId === "trainer-1") {
        return Promise.resolve(null); // never assisted -> should alert
      }
      if (where.trainerId === "trainer-2") {
        return Promise.resolve({ completedAt: daysAgo(1) }); // recent -> no alert
      }
      if (where.trainerId === "trainer-3") {
        return Promise.resolve({ completedAt: daysAgo(ABANDONMENT_ALERT_THRESHOLD_DAYS + 100) }); // overdue -> alert
      }
      return Promise.resolve(null);
    });

    await gymService.checkIn("user-123");
    await flushMicrotasks();

    const alertedTrainerIds = communicationService.notifyTrainerOfReturningStudent.mock.calls.map(
      (call) => call[0]
    );
    expect(alertedTrainerIds.sort()).toEqual(["trainer-1", "trainer-3"]);
    expect(alertedTrainerIds).not.toContain("trainer-2");
  });

  it("does not fire any alert when alertNow is explicitly disabled", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "user-123",
      firstName: "Ana",
      lastName: "Gomez",
      settings: { trainerPreference: "trainer-1", disableAssistance: false },
    });
    prisma.assistance.findMany.mockResolvedValue([]);
    prisma.assistance.findFirst.mockResolvedValue(null);

    await gymService.checkIn("user-123", { alertNow: false });
    await flushMicrotasks();

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(communicationService.notifyTrainerOfReturningStudent).not.toHaveBeenCalled();
  });
});
