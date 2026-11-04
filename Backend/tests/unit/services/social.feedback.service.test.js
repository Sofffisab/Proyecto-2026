import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "../../../src/config/prisma.js";
import { submitFeedback, ageBucket, shapeChallenge } from "../../../src/services/social.service.js";

vi.mock("../../../src/realtime/ably.js", () => ({
  createSocialTokenRequest: vi.fn(),
  getLobbyMemberIds: vi.fn(),
  publishToLobby: vi.fn(),
  publishToUsers: vi.fn(),
}));

const challenge = (over = {}) => ({ id: "c1", userId: "a", partnerUserId: "b", status: "COMPLETED", ...over });

describe("ageBucket", () => {
  it("groups ages in 5-year ranges instead of exposing the exact age", () => {
    expect(ageBucket(new Date("2000-01-01"), new Date("2026-11-03"))).toEqual({ from: 25, to: 29 });
    expect(ageBucket(null)).toBeNull();
  });
});

describe("shapeChallenge", () => {
  it("only includes the partner card when given", () => {
    expect(shapeChallenge(challenge({ status: "ACCEPTED", qrHolderId: "a" }), "a")).not.toHaveProperty("partner");
    expect(shapeChallenge(challenge({ status: "ACCEPTED", qrHolderId: "a" }), "a", Date.now(), { name: "Ivo" }).partner).toEqual({ name: "Ivo" });
  });
});

describe("submitFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.socialFeedback = { create: vi.fn().mockResolvedValue({}) };
    prisma.denuncia = { create: vi.fn().mockResolvedValue({}) };
  });

  it("stores rating/like and files a MEMBER_MISCONDUCT denuncia when reported", async () => {
    prisma.socialChallenge.findUnique.mockResolvedValue(challenge());
    const res = await submitFeedback("a", "c1", { rating: 4, liked: true, report: true });
    expect(res).toEqual({ saved: true });
    expect(prisma.socialFeedback.create.mock.calls[0][0].data).toMatchObject({ userId: "a", rating: 4, liked: true, reported: true });
    expect(prisma.denuncia.create.mock.calls[0][0].data).toMatchObject({ reporterId: "a", reportedUserId: "b", type: "MEMBER_MISCONDUCT" });
  });

  it("rejects people outside the interaction and unfinished interactions", async () => {
    prisma.socialChallenge.findUnique.mockResolvedValue(challenge());
    await expect(submitFeedback("zzz", "c1", {})).rejects.toMatchObject({ statusCode: 403 });
    prisma.socialChallenge.findUnique.mockResolvedValue(challenge({ status: "ACCEPTED" }));
    await expect(submitFeedback("a", "c1", {})).rejects.toMatchObject({ statusCode: 400 });
  });

  it("ignores a second feedback from the same person", async () => {
    prisma.socialChallenge.findUnique.mockResolvedValue(challenge());
    prisma.socialFeedback.create.mockRejectedValue({ code: "P2002" });
    expect(await submitFeedback("a", "c1", { report: true })).toEqual({ saved: false });
    expect(prisma.denuncia.create).not.toHaveBeenCalled();
  });
});
