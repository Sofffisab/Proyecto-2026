import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma.js";
import redis from "../../../src/config/redis.js";
import * as ably from "../../../src/realtime/ably.js";
import { runMatchingRound } from "../../../src/services/social.service.js";

vi.mock("../../../src/realtime/ably.js", () => ({
  createSocialTokenRequest: vi.fn(),
  getLobbyMemberIds: vi.fn(),
  publishToLobby: vi.fn(),
  publishToUsers: vi.fn(),
}));

const session = (userId, gender, birthday = new Date("1995-01-01")) => ({ userId, user: { gender, birthday } });

function setup({ sessions, settings = [], blocks = [] }) {
  ably.getLobbyMemberIds.mockResolvedValue(sessions.map((s) => s.userId));
  prisma.gymSession.findFirst.mockResolvedValue({ id: "caller-session" });
  prisma.gymSession.findMany.mockResolvedValue(sessions);
  prisma.userSettings.findMany.mockResolvedValue(settings);
  prisma.userBlock.findMany.mockResolvedValue(blocks);
  prisma.socialChallenge.findMany.mockResolvedValue([]);
  prisma.socialChallenge.create.mockImplementation(async ({ data }) => ({ id: `c-${data.userId}-${data.partnerUserId}`, ...data }));
}

const pairedIds = () =>
  prisma.socialChallenge.create.mock.calls.map(([{ data }]) => [data.userId, data.partnerUserId].sort().join("|"));

describe("runMatchingRound with social filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.set.mockResolvedValue("OK"); // this instance wins the round lock
  });

  it("pairs two people with no filters", async () => {
    setup({ sessions: [session("a", "MALE"), session("b", "FEMALE")] });
    const res = await runMatchingRound("a");
    expect(res).toEqual({ ran: true, paired: 1 });
  });

  it("never pairs someone who disabled social interactions", async () => {
    setup({
      sessions: [session("a", "MALE"), session("b", "MALE")],
      settings: [{ userId: "b", disableSocial: true, socialSameGenderOnly: false, socialSameAgeRangeOnly: false }],
    });
    expect(await runMatchingRound("a")).toEqual({ ran: true, paired: 0 });
  });

  const genderFilter = { userId: "a", disableSocial: false, socialSameGenderOnly: true, socialSameAgeRangeOnly: false };
  const ageFilter = { userId: "a", disableSocial: false, socialSameGenderOnly: false, socialSameAgeRangeOnly: true };

  it("'same gender only' keeps a man and a woman apart (the filter is mutual)", async () => {
    setup({ sessions: [session("a", "MALE"), session("b", "FEMALE")], settings: [genderFilter] });
    expect(await runMatchingRound("a")).toEqual({ ran: true, paired: 0 });

    // ...also when it is the OTHER person who set the filter
    vi.clearAllMocks();
    redis.set.mockResolvedValue("OK");
    setup({ sessions: [session("a", "MALE"), session("b", "FEMALE")], settings: [{ ...genderFilter, userId: "b" }] });
    expect(await runMatchingRound("a")).toEqual({ ran: true, paired: 0 });
  });

  it("'same gender only' still pairs people of the same gender", async () => {
    setup({ sessions: [session("a", "MALE"), session("c", "MALE")], settings: [genderFilter] });
    await runMatchingRound("a");
    expect(pairedIds()).toEqual(["a|c"]);
  });

  it("'same age range only' keeps a 30-year-old away from a 65-year-old", async () => {
    setup({
      sessions: [session("a", "MALE", new Date("1995-01-01")), session("b", "MALE", new Date("1960-01-01"))],
      settings: [ageFilter],
    });
    expect(await runMatchingRound("a")).toEqual({ ran: true, paired: 0 });
  });

  it("'same age range only' pairs people of a similar age", async () => {
    setup({
      sessions: [session("a", "MALE", new Date("1995-01-01")), session("c", "MALE", new Date("1997-01-01"))],
      settings: [ageFilter],
    });
    await runMatchingRound("a");
    expect(pairedIds()).toEqual(["a|c"]);
  });

  it("never pairs two people when one blocked the other", async () => {
    setup({
      sessions: [session("a", "MALE"), session("b", "MALE")],
      blocks: [{ blockerId: "b", blockedId: "a" }],
    });
    expect(await runMatchingRound("a")).toEqual({ ran: true, paired: 0 });
    expect(prisma.socialChallenge.create).not.toHaveBeenCalled();
  });

  it("skips the blocked person but still pairs the others", async () => {
    setup({
      sessions: [session("a", "MALE"), session("b", "MALE"), session("c", "MALE")],
      blocks: [{ blockerId: "a", blockedId: "b" }],
    });
    expect((await runMatchingRound("a")).ran).toBe(true);
    expect(pairedIds()).toHaveLength(1);
    expect(pairedIds()).not.toContain("a|b");
  });
});
