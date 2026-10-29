import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { createUserAndLogin } from "../helpers/testAuth.js";

// End-to-end flow of the real-time "¿Querés hacer un amigo?" interaction,
// driven only through the HTTP API (the same requests the app makes). Ably is
// replaced by an in-memory double so we can assert exactly what each phone
// would have received, and who is "in the lobby" (= has the app open).

vi.mock("../../src/config/prisma.js", async () => {
  const { createE2EPrismaMock } = await import("../helpers/e2ePrismaMock.js");
  return { default: createE2EPrismaMock() };
});

// Redis double that honours SET NX (the per-round lock) — the shared helper doesn't.
vi.mock("../../src/config/redis.js", async () => {
  const store = new Map();
  return {
    default: {
      get: vi.fn(async (key) => store.get(key) ?? null),
      set: vi.fn(async (key, value, opts) => {
        if (opts?.nx && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      }),
      setex: vi.fn(async (key, _ttl, value) => store.set(key, value)),
      del: vi.fn(async (key) => store.delete(key)),
      expire: vi.fn(async () => 1),
      __clear: () => store.clear(),
    },
  };
});

vi.mock("../../src/middlewares/rateLimiter.js", () => {
  const passthrough = (req, res, next) => next();
  return {
    authRateLimiter: passthrough,
    apiRateLimiter: passthrough,
    default: { authRateLimiter: passthrough, apiRateLimiter: passthrough },
  };
});

const ably = { published: [], lobby: [] };

vi.mock("../../src/realtime/ably.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    publishToUsers: vi.fn(async (messages) => {
      ably.published.push(...messages.map((m) => ({ ...m, scope: "user" })));
    }),
    publishToLobby: vi.fn(async (event, data) => {
      ably.published.push({ scope: "lobby", event, data });
    }),
    getLobbyMemberIds: vi.fn(async () => [...ably.lobby]),
    createSocialTokenRequest: vi.fn(async (userId) => ({ clientId: userId, keyName: "k.n" })),
  };
});

const app = (await import("../../src/server.js")).default;
const prisma = (await import("../../src/config/prisma.js")).default;
const redis = (await import("../../src/config/redis.js")).default;

const COMPLETE_PROFILE = {
  birthday: new Date("1995-05-05"),
  medicalConditions: [],
  deliveryAddress: "Calle 123",
  trainingLevel: "BEGINNER",
  objectives: ["IMPROVE_HEALTH"],
  weeklyTrainingDays: "THREE",
  trainingType: "MIXED",
};

const eventsFor = (userId, event) =>
  ably.published.filter((m) => m.scope === "user" && m.userId === userId && m.event === event);

const pointsOf = async (userId) =>
  (await prisma.pointTransaction.findMany({ where: { userId } })).reduce((sum, t) => sum + t.points, 0);

describe("Social interactions E2E", () => {
  let server;
  let alice;
  let bob;

  const api = (user) => ({
    get: (path) => request(server).get(path).set("Authorization", `Bearer ${user.accessToken}`),
    post: (path, body) =>
      request(server).post(path).set("Authorization", `Bearer ${user.accessToken}`).send(body),
  });

  const makeUser = async (name, extra = {}) => {
    const user = await createUserAndLogin(server, prisma, {
      email: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      firstName: name,
      ...COMPLETE_PROFILE,
      ...extra,
    });
    return user;
  };

  const checkIn = (user) =>
    prisma.gymSession.create({ data: { userId: user.userId, checkInAt: new Date() } });

  // Runs a round and returns the single challenge it created for these two.
  const matchAliceAndBob = async () => {
    const res = await api(alice).post("/social/tick", {});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ran: true, paired: 1 });
    const challenge = (await prisma.socialChallenge.findMany({ where: { isRealtime: true } }))[0];
    return challenge;
  };

  beforeAll(() => {
    server = app.listen(3011);
  });

  afterAll(() => server.close());

  beforeEach(async () => {
    ably.published.length = 0;
    redis.__clear();
    // every test starts with an empty challenge table and fresh users
    const stale = await prisma.socialChallenge.findMany({});
    for (const c of stale) await prisma.socialChallenge.delete({ where: { id: c.id } });
    for (const s of await prisma.gymSession.findMany({})) {
      await prisma.gymSession.delete({ where: { id: s.id } });
    }

    alice = await makeUser("Alice");
    bob = await makeUser("Bob");
    await checkIn(alice);
    await checkIn(bob);
    ably.lobby = [alice.userId, bob.userId];
  });

  describe("matching round", () => {
    it("pairs two people who are in the gym with the app open and invites both", async () => {
      const challenge = await matchAliceAndBob();

      expect(challenge.status).toBe("ASSIGNED");
      expect(new Set([challenge.userId, challenge.partnerUserId])).toEqual(
        new Set([alice.userId, bob.userId])
      );
      expect(eventsFor(alice.userId, "invite")).toHaveLength(1);
      expect(eventsFor(bob.userId, "invite")).toHaveLength(1);
      expect(eventsFor(alice.userId, "invite")[0].data.challengeId).toBe(challenge.id);
    });

    it("runs only once per interval no matter how many clients ask (Redis lock)", async () => {
      await matchAliceAndBob();

      const again = await api(bob).post("/social/tick", {});

      expect(again.status).toBe(200);
      expect(again.body.data).toEqual({ ran: false, paired: 0 });
      expect(await prisma.socialChallenge.count({ where: {} })).toBe(1);
    });

    it("does not pair someone who has the app closed (not in the Ably lobby)", async () => {
      ably.lobby = [alice.userId];

      const res = await api(alice).post("/social/tick", {});

      expect(res.body.data).toMatchObject({ ran: true, paired: 0 });
      expect(eventsFor(bob.userId, "invite")).toHaveLength(0);
    });

    it("does not pair someone who is in the lobby but already checked out of the gym", async () => {
      const [bobSession] = await prisma.gymSession.findMany({ where: { userId: bob.userId } });
      await prisma.gymSession.update({
        where: { id: bobSession.id },
        data: { checkOutAt: new Date() },
      });

      const res = await api(alice).post("/social/tick", {});

      expect(res.body.data.paired).toBe(0);
    });

    it("skips anyone who turned off social interactions in Edit profile", async () => {
      await prisma.userSettings.create({ data: { userId: bob.userId, disableSocial: true } });

      const res = await api(alice).post("/social/tick", {});

      expect(res.body.data.paired).toBe(0);
      expect(eventsFor(bob.userId, "invite")).toHaveLength(0);
    });

    it("never starts a second challenge for someone who is already in one", async () => {
      await matchAliceAndBob();
      const carol = await makeUser("Carol");
      await checkIn(carol);
      ably.lobby = [alice.userId, bob.userId, carol.userId];
      redis.__clear(); // pretend the next interval started

      const res = await api(carol).post("/social/tick", {});

      expect(res.body.data.paired).toBe(0); // alice+bob are busy, carol has nobody
    });

    it("does not re-pair the same two people right after they were paired", async () => {
      const challenge = await matchAliceAndBob();
      await api(alice).post(`/social/${challenge.id}/cancel`, {});
      redis.__clear();

      const res = await api(alice).post("/social/tick", {});

      expect(res.body.data.paired).toBe(0);
    });

    it("refuses to run a round for someone who is not inside the gym", async () => {
      const dave = await makeUser("Dave");

      const res = await api(dave).post("/social/tick", {});

      expect(res.status).toBe(403);
    });

    it("is members-only", async () => {
      const trainer = await makeUser("Trainer", { role: "TRAINER" });

      expect((await api(trainer).post("/social/tick", {})).status).toBe(403);
      expect((await api(trainer).get("/social/state")).status).toBe(403);
    });
  });

  describe("answering the invitation", () => {
    it("Yes from one person only records the answer — the second pop-up waits for the other", async () => {
      const challenge = await matchAliceAndBob();

      const res = await api(alice).post(`/social/${challenge.id}/respond`, { accept: true });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ status: "ASSIGNED", accepted: true, partnerAccepted: false, role: null });
      expect(eventsFor(alice.userId, "paired")).toHaveLength(0);
      expect(eventsFor(bob.userId, "paired")).toHaveLength(0);
    });

    it("when both say Yes, the first to accept gets the QR and the second gets the camera", async () => {
      const challenge = await matchAliceAndBob();

      await api(bob).post(`/social/${challenge.id}/respond`, { accept: true }); // first
      const second = await api(alice).post(`/social/${challenge.id}/respond`, { accept: true });

      expect(second.body.data).toMatchObject({ status: "ACCEPTED", role: "SCAN" });
      const bobPaired = eventsFor(bob.userId, "paired");
      const alicePaired = eventsFor(alice.userId, "paired");
      expect(bobPaired).toHaveLength(1);
      expect(alicePaired).toHaveLength(1);
      expect(bobPaired[0].data.role).toBe("SHOW_QR");
      expect(alicePaired[0].data.role).toBe("SCAN");
      // two minutes to scan
      expect(bobPaired[0].data.ttlMs).toBeGreaterThan(110000);
      expect(bobPaired[0].data.ttlMs).toBeLessThanOrEqual(120000);
    });

    it("answering Yes twice is harmless", async () => {
      const challenge = await matchAliceAndBob();

      await api(alice).post(`/social/${challenge.id}/respond`, { accept: true });
      const again = await api(alice).post(`/social/${challenge.id}/respond`, { accept: true });

      expect(again.status).toBe(200);
      expect(again.body.data.accepted).toBe(true);
    });

    it("rejects someone who is not part of the challenge", async () => {
      const challenge = await matchAliceAndBob();
      const mallory = await makeUser("Mallory");

      const res = await api(mallory).post(`/social/${challenge.id}/respond`, { accept: true });

      expect(res.status).toBe(403);
    });

    it("validates the body", async () => {
      const challenge = await matchAliceAndBob();

      const res = await api(alice).post(`/social/${challenge.id}/respond`, { accept: "yes" });

      expect(res.status).toBe(422);
    });

    it("an invitation nobody answered in time expires: 410, no points", async () => {
      const challenge = await matchAliceAndBob();
      await prisma.socialChallenge.update({
        where: { id: challenge.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await api(alice).post(`/social/${challenge.id}/respond`, { accept: true });

      expect(res.status).toBe(410);
      expect((await prisma.socialChallenge.findUnique({ where: { id: challenge.id } })).status).toBe("EXPIRED");
      expect(eventsFor(bob.userId, "expired")).toHaveLength(1);
      expect(await pointsOf(alice.userId)).toBe(0);
    });
  });

  describe("declining / closing", () => {
    it("No from one person gives the reduced points only to the one who had accepted", async () => {
      const challenge = await matchAliceAndBob();
      await api(alice).post(`/social/${challenge.id}/respond`, { accept: true });

      const res = await api(bob).post(`/social/${challenge.id}/respond`, { accept: false });

      expect(res.status).toBe(200);
      expect((await prisma.socialChallenge.findUnique({ where: { id: challenge.id } })).status).toBe("REJECTED");
      expect(await pointsOf(alice.userId)).toBe(10);
      expect(await pointsOf(bob.userId)).toBe(0);
      expect(eventsFor(alice.userId, "cancelled")[0].data).toMatchObject({ points: 10 });
    });

    it("No when the other one had not answered yet gives nobody points", async () => {
      const challenge = await matchAliceAndBob();

      await api(alice).post(`/social/${challenge.id}/respond`, { accept: false });

      expect(await pointsOf(alice.userId)).toBe(0);
      expect(await pointsOf(bob.userId)).toBe(0);
      expect(eventsFor(bob.userId, "cancelled")[0].data.points).toBe(0);
    });

    it("closing the QR/camera pop-up cancels it: the other one gets reduced points, the closer gets none", async () => {
      const challenge = await matchAliceAndBob();
      await api(bob).post(`/social/${challenge.id}/respond`, { accept: true });
      await api(alice).post(`/social/${challenge.id}/respond`, { accept: true });

      await api(alice).post(`/social/${challenge.id}/cancel`, {});

      expect(await pointsOf(bob.userId)).toBe(10);
      expect(await pointsOf(alice.userId)).toBe(0);
      expect(eventsFor(bob.userId, "cancelled")[0].data).toMatchObject({ points: 10 });
    });

    it("leaving the gym in the middle of an interaction cancels it (reduced points for the one who stays)", async () => {
      const challenge = await matchAliceAndBob();
      await api(bob).post(`/social/${challenge.id}/respond`, { accept: true });
      const { cancelOpenChallengesFor } = await import("../../src/services/social.service.js");

      const cancelled = await cancelOpenChallengesFor(alice.userId); // alice scans the exit QR

      expect(cancelled).toBe(1);
      expect((await prisma.socialChallenge.findUnique({ where: { id: challenge.id } })).status).toBe("REJECTED");
      expect(await pointsOf(bob.userId)).toBe(10);
      expect(await pointsOf(alice.userId)).toBe(0);
    });

    it("cancelling twice does not pay twice", async () => {
      const challenge = await matchAliceAndBob();
      await api(bob).post(`/social/${challenge.id}/respond`, { accept: true });
      await api(alice).post(`/social/${challenge.id}/respond`, { accept: true });

      await api(alice).post(`/social/${challenge.id}/cancel`, {});
      await api(alice).post(`/social/${challenge.id}/cancel`, {});

      expect(await pointsOf(bob.userId)).toBe(10);
    });
  });

  describe("scanning the QR", () => {
    const pairBoth = async () => {
      const challenge = await matchAliceAndBob();
      await api(bob).post(`/social/${challenge.id}/respond`, { accept: true }); // bob shows QR
      await api(alice).post(`/social/${challenge.id}/respond`, { accept: true }); // alice scans
      return challenge;
    };

    it("a correct scan gives full points to both and closes the pop-up on both phones", async () => {
      const challenge = await pairBoth();
      const qr = (await api(bob).get("/qr/me")).body.data;

      const scan = await api(alice).post("/qr/scan", { payload: JSON.stringify(qr) });

      expect(scan.status).toBe(200);
      expect(scan.body.data).toMatchObject({ success: true, points: 30 });
      expect((await prisma.socialChallenge.findUnique({ where: { id: challenge.id } })).status).toBe("COMPLETED");
      expect(await pointsOf(alice.userId)).toBe(30);
      expect(await pointsOf(bob.userId)).toBe(30);
      expect(eventsFor(alice.userId, "completed")).toHaveLength(1);
      expect(eventsFor(bob.userId, "completed")).toHaveLength(1);
    });

    it("scanning the same QR again cannot award points twice", async () => {
      await pairBoth();
      const qr = JSON.stringify((await api(bob).get("/qr/me")).body.data);

      await api(alice).post("/qr/scan", { payload: qr });
      const second = await api(alice).post("/qr/scan", { payload: qr });

      expect(second.status).not.toBe(200);
      expect(await pointsOf(alice.userId)).toBe(30);
    });

    it("after 2 minutes the scan is refused, the challenge expires and nobody gets points", async () => {
      const challenge = await pairBoth();
      await prisma.socialChallenge.update({
        where: { id: challenge.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const qr = JSON.stringify((await api(bob).get("/qr/me")).body.data);

      const scan = await api(alice).post("/qr/scan", { payload: qr });

      expect(scan.status).not.toBe(200);
      expect((await prisma.socialChallenge.findUnique({ where: { id: challenge.id } })).status).toBe("EXPIRED");
      expect(await pointsOf(alice.userId)).toBe(0);
      expect(await pointsOf(bob.userId)).toBe(0);
    });

    it("the next round sweeps challenges nobody finished and tells both phones", async () => {
      const challenge = await pairBoth();
      await prisma.socialChallenge.update({
        where: { id: challenge.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      redis.__clear();

      await api(alice).post("/social/tick", {});

      expect((await prisma.socialChallenge.findUnique({ where: { id: challenge.id } })).status).toBe("EXPIRED");
      expect(eventsFor(alice.userId, "expired")).toHaveLength(1);
      expect(eventsFor(bob.userId, "expired")).toHaveLength(1);
    });
  });

  describe("bootstrap / edit profile", () => {
    it("GET /social/state reports gym presence, the opt-out and the challenge in progress in one request", async () => {
      const before = await api(alice).get("/social/state");
      expect(before.body.data).toMatchObject({ inGym: true, disabled: false, challenge: null });
      expect(before.body.data.roundIntervalMs).toBe(120000);

      const challenge = await matchAliceAndBob();
      const during = await api(alice).get("/social/state");

      expect(during.body.data.challenge).toMatchObject({ id: challenge.id, status: "ASSIGNED", accepted: false });
      expect(during.body.data.challenge.ttlMs).toBeGreaterThan(0);
    });

    it("the 'no social interactions' preference saved from Edit profile shows up as disabled", async () => {
      const save = await request(server)
        .patch("/users/me/settings")
        .set("Authorization", `Bearer ${alice.accessToken}`)
        .send({ disableSocial: true });
      expect(save.status).toBe(200);

      const state = await api(alice).get("/social/state");

      expect(state.body.data.disabled).toBe(true);
    });

    it("state says not in gym after checking out", async () => {
      const [session] = await prisma.gymSession.findMany({ where: { userId: alice.userId } });
      await prisma.gymSession.update({ where: { id: session.id }, data: { checkOutAt: new Date() } });

      const state = await api(alice).get("/social/state");

      expect(state.body.data.inGym).toBe(false);
    });

    it("hands out an Ably token request tied to the user", async () => {
      const res = await api(alice).get("/social/ably-token");

      expect(res.status).toBe(200);
      expect(res.body.data.clientId).toBe(alice.userId);
    });
  });
});
