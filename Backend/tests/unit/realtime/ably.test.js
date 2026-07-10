import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// src/realtime/ably.js talks to the real "ably" package at import time, so we
// mock it before importing the module under test. A fresh mocked channel per
// test lets us assert exactly what gets published without hitting Ably.
const publishMock = vi.fn();

vi.mock("ably", () => {
  return {
    default: {
      Rest: vi.fn().mockImplementation(() => ({
        channels: {
          get: vi.fn(() => ({ publish: publishMock })),
        },
      })),
    },
  };
});

describe("realtime/ably", () => {
  const ORIGINAL_ENV = process.env.ABLY_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    publishMock.mockClear();
    process.env.ABLY_API_KEY = "test-ably-key";
  });

  afterEach(() => {
    process.env.ABLY_API_KEY = ORIGINAL_ENV;
  });

  it("publishes presence events to the presence channel", async () => {
    const { emitPresenceEvent } = await import("../../../src/realtime/ably.js");

    emitPresenceEvent("USER_ONLINE", { userId: "user-1" });

    expect(publishMock).toHaveBeenCalledWith("USER_ONLINE", { userId: "user-1" });
  });

  it("publishes assistance events to the assistance channel", async () => {
    const { emitAssistanceEvent } = await import("../../../src/realtime/ably.js");

    emitAssistanceEvent("ASSISTANCE_REQUESTED", { userId: "user-1" });

    expect(publishMock).toHaveBeenCalledWith("ASSISTANCE_REQUESTED", { userId: "user-1" });
  });

  it("publishes social events to the social channel", async () => {
    const { emitSocialEvent } = await import("../../../src/realtime/ably.js");

    emitSocialEvent("FRIEND_REQUEST", { from: "user-1" });

    expect(publishMock).toHaveBeenCalledWith("FRIEND_REQUEST", { from: "user-1" });
  });

  it("publishes generic notifications under a fixed event name", async () => {
    const { emitNotificationEvent } = await import("../../../src/realtime/ably.js");

    emitNotificationEvent({ title: "Hello" });

    expect(publishMock).toHaveBeenCalledWith("GENERIC_NOTIFICATION", { title: "Hello" });
  });

  it("emits a needs-attention event with the expected shape", async () => {
    const { emitUserNeedsAttention } = await import("../../../src/realtime/ably.js");

    emitUserNeedsAttention("user-1", "2026-01-01T00:00:00.000Z", 15);

    expect(publishMock).toHaveBeenCalledWith("USER_NEEDS_ATTENTION", {
      userId: "user-1",
      lastAssistanceAt: "2026-01-01T00:00:00.000Z",
      minutesWithoutAssistance: 15,
    });
  });

  it("does not throw and skips publishing when Ably failed to initialize", async () => {
    delete process.env.ABLY_API_KEY;

    const { emitPresenceEvent } = await import("../../../src/realtime/ably.js");

    expect(() => emitPresenceEvent("USER_ONLINE", { userId: "user-1" })).not.toThrow();
    expect(publishMock).not.toHaveBeenCalled();
  });
});
