import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Social-interaction helpers in src/realtime/ably.js. The "ably" package is
// mocked so we can assert exactly what would be sent to Ably.
const batchPublish = vi.fn();
const createTokenRequest = vi.fn();
const channelPublish = vi.fn();
const presenceGet = vi.fn();
const channelsGet = vi.fn(() => ({ publish: channelPublish, presence: { get: presenceGet } }));

vi.mock("ably", () => ({
  default: {
    Rest: vi.fn().mockImplementation(() => ({
      channels: { get: channelsGet },
      batchPublish,
      auth: { createTokenRequest },
    })),
  },
}));

describe("realtime/ably — social interactions", () => {
  const ORIGINAL_ENV = process.env.ABLY_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.ABLY_API_KEY = "test-ably-key";
  });

  afterEach(() => {
    process.env.ABLY_API_KEY = ORIGINAL_ENV;
  });

  it("names the private channel after the user", async () => {
    const { socialUserChannel } = await import("../../../src/realtime/ably.js");
    expect(socialUserChannel("u1")).toBe("social:user:u1");
  });

  it("issues a token locked to the lobby presence + the user's own channel (subscribe only)", async () => {
    createTokenRequest.mockResolvedValue({ keyName: "k" });
    const { createSocialTokenRequest } = await import("../../../src/realtime/ably.js");

    await createSocialTokenRequest("u1");

    const params = createTokenRequest.mock.calls[0][0];
    expect(params.clientId).toBe("u1");
    expect(JSON.parse(params.capability)).toEqual({
      "social:lobby": ["subscribe", "presence"],
      "social:user:u1": ["subscribe"],
    });
    // the user must never be able to publish or read someone else's channel
    expect(params.capability).not.toContain("publish");
  });

  it("returns null instead of a token when Ably is not configured", async () => {
    delete process.env.ABLY_API_KEY;
    const { createSocialTokenRequest } = await import("../../../src/realtime/ably.js");
    expect(await createSocialTokenRequest("u1")).toBeNull();
  });

  it("sends all per-user events in ONE batch request", async () => {
    batchPublish.mockResolvedValue([]);
    const { publishToUsers } = await import("../../../src/realtime/ably.js");

    await publishToUsers([
      { userId: "a", event: "invite", data: { challengeId: "c1" } },
      { userId: "b", event: "invite", data: { challengeId: "c1" } },
    ]);

    expect(batchPublish).toHaveBeenCalledTimes(1);
    expect(batchPublish).toHaveBeenCalledWith([
      { channels: ["social:user:a"], messages: [{ name: "invite", data: { challengeId: "c1" } }] },
      { channels: ["social:user:b"], messages: [{ name: "invite", data: { challengeId: "c1" } }] },
    ]);
  });

  it("does nothing for an empty list", async () => {
    const { publishToUsers } = await import("../../../src/realtime/ably.js");
    await publishToUsers([]);
    expect(batchPublish).not.toHaveBeenCalled();
  });

  it("never throws when Ably fails (a lost push must not break the API request)", async () => {
    batchPublish.mockRejectedValue(new Error("ably down"));
    const { publishToUsers } = await import("../../../src/realtime/ably.js");

    await expect(
      publishToUsers([{ userId: "a", event: "invite", data: {} }])
    ).resolves.toBeUndefined();
  });

  it("publishes lobby events on the lobby channel", async () => {
    channelPublish.mockResolvedValue();
    const { publishToLobby } = await import("../../../src/realtime/ably.js");

    await publishToLobby("round", { paired: 2 });

    expect(channelsGet).toHaveBeenCalledWith("social:lobby");
    expect(channelPublish).toHaveBeenCalledWith("round", { paired: 2 });
  });

  it("lists lobby members across pages without duplicates", async () => {
    const page2 = { items: [{ clientId: "b" }, { clientId: "c" }], hasNext: () => false };
    const page1 = {
      items: [{ clientId: "a" }, { clientId: "b" }],
      hasNext: () => true,
      next: vi.fn().mockResolvedValue(page2),
    };
    presenceGet.mockResolvedValue(page1);
    const { getLobbyMemberIds } = await import("../../../src/realtime/ably.js");

    expect((await getLobbyMemberIds()).sort()).toEqual(["a", "b", "c"]);
  });

  it("reports null when Ably is unavailable so the caller can skip the round", async () => {
    delete process.env.ABLY_API_KEY;
    const { getLobbyMemberIds } = await import("../../../src/realtime/ably.js");
    expect(await getLobbyMemberIds()).toBeNull();
  });
});
