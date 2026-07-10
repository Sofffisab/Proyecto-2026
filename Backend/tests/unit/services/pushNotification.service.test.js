import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma.js";
import { firebase } from "../../../src/config/firebase.js";
import { sendTrainerAlert } from "../../../src/services/pushNotification.service.js";

vi.mock("../../../src/config/firebase.js", () => ({
  firebase: {
    messaging: vi.fn(),
  },
}));

describe("pushNotification.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips sending and reports all as skipped when firebase isn't initialized", async () => {
    vi.resetModules();
    vi.doMock("../../../src/config/firebase.js", () => ({ firebase: null }));

    const { sendTrainerAlert: sendWithNoFirebase } = await import(
      "../../../src/services/pushNotification.service.js"
    );

    const result = await sendWithNoFirebase({
      trainerIds: ["trainer-1", "trainer-2"],
      type: "SOS",
      payload: {},
    });

    expect(result).toEqual({ sent: 0, skipped: 2 });

    // Restore the normal mocked firebase module for subsequent tests in this file.
    vi.doUnmock("../../../src/config/firebase.js");
    vi.resetModules();
  });

  it("returns skipped when no trainers have a registered fcmToken", async () => {
    prisma.user.findMany.mockResolvedValue([]);

    const result = await sendTrainerAlert({
      trainerIds: ["trainer-1", "trainer-2"],
      type: "SOS",
      payload: { sessionId: "session-1" },
    });

    expect(result).toEqual({ sent: 0, skipped: 2 });
  });

  it("sends a data-only multicast message to trainers with an fcmToken", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "trainer-1", fcmToken: "token-1" },
      { id: "trainer-2", fcmToken: "token-2" },
    ]);
    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });
    firebase.messaging.mockReturnValue({ sendEachForMulticast });

    const result = await sendTrainerAlert({
      trainerIds: ["trainer-1", "trainer-2"],
      type: "SOS",
      payload: { sessionId: "session-1" },
    });

    expect(sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ["token-1", "token-2"],
        data: expect.objectContaining({ type: "SOS", sessionId: "session-1" }),
      })
    );
    expect(result).toEqual({ sent: 2, skipped: 0 });
  });

  it("stringifies all data payload values (FCM requires string values)", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "trainer-1", fcmToken: "token-1" }]);
    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
    firebase.messaging.mockReturnValue({ sendEachForMulticast });

    await sendTrainerAlert({
      trainerIds: ["trainer-1"],
      type: "SOS",
      payload: { count: 3, active: true },
    });

    const callArg = sendEachForMulticast.mock.calls[0][0];
    expect(callArg.data.count).toBe("3");
    expect(callArg.data.active).toBe("true");
  });

  it("returns partial success counts when some deliveries fail", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "trainer-1", fcmToken: "token-1" },
      { id: "trainer-2", fcmToken: "token-2" },
    ]);
    const sendEachForMulticast = vi.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [{ success: true }, { success: false, error: { message: "invalid token" } }],
    });
    firebase.messaging.mockReturnValue({ sendEachForMulticast });

    const result = await sendTrainerAlert({
      trainerIds: ["trainer-1", "trainer-2"],
      type: "SOS",
      payload: {},
    });

    expect(result).toEqual({ sent: 1, skipped: 1 });
  });

  it("returns all skipped when the Firebase call itself throws", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "trainer-1", fcmToken: "token-1" }]);
    firebase.messaging.mockImplementation(() => {
      throw new Error("Firebase down");
    });

    const result = await sendTrainerAlert({
      trainerIds: ["trainer-1"],
      type: "SOS",
      payload: {},
    });

    expect(result).toEqual({ sent: 0, skipped: 1 });
  });
});
