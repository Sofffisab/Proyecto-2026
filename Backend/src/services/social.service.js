// Real-time social interactions ("¿Querés hacer un amigo?" pop-up).
//
// Flow
//   1. Everyone who is inside the gym (between the entry QR scan and the exit
//      QR scan = GymSession.checkOutAt is null) and has the app open sits in
//      the Ably lobby presence. The app does NOT have to poll the backend.
//   2. Every SOCIAL_ROUND_INTERVAL_MS one client (the "leader", see the
//      frontend) calls POST /social/tick -> runMatchingRound(): it pairs the
//      eligible people at random and sends each of them an `invite`.
//   3. Both answer Yes/No (respondToChallenge). When both said Yes the
//      challenge becomes ACCEPTED: the first one to accept gets a QR, the
//      other one gets the camera (`paired` event).
//   4. The camera user scans the QR -> POST /qr/scan -> completeChallengeByQR
//      (challenge.service.js) gives points to both and emits `completed`.
//   5. Nobody scans within SOCIAL_QR_TTL_MS -> EXPIRED, no points.
//      Someone cancels -> REJECTED, and ONLY the other person (if they had
//      accepted) gets the smaller SOCIAL_CHALLENGE_ATTEMPTED points.
//
// Request budget (the app must stay fast): matching is one request per round
// for the whole gym, answering is one request per person, and everything else
// (invites, pairing, completion, cancellation) is pushed through Ably.

import { prisma, redis } from "../config/index.js";
import { POINTS } from "../constants/points.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { addPoints } from "./gamification.service.js";
import {
  createSocialTokenRequest,
  getLobbyMemberIds,
  publishToLobby,
  publishToUsers,
} from "../realtime/ably.js";

const OPEN_STATUSES = ["ASSIGNED", "ACCEPTED"];
const MAX_PAIRS_PER_ROUND = 50;

// Read lazily so tests (and Vercel env changes) are picked up without a reload.
export function getSocialConfig() {
  const int = (name, fallback) => {
    const value = parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    // How often a matching round happens (spec: every 2 minutes).
    roundIntervalMs: int("SOCIAL_ROUND_INTERVAL_MS", 2 * 60 * 1000),
    // How long people have to press Yes/No after the invitation arrives.
    inviteTtlMs: int("SOCIAL_INVITE_TTL_MS", 60 * 1000),
    // Time to scan once both accepted (spec: 2 minutes).
    qrTtlMs: int("SOCIAL_QR_TTL_MS", 2 * 60 * 1000),
    // The same two people are not paired again for this long.
    pairCooldownMs: int("SOCIAL_PAIR_COOLDOWN_MS", 30 * 60 * 1000),
  };
}

// ── helpers ──────────────────────────────────────────────────────────────

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const otherParticipant = (challenge, userId) =>
  challenge.userId === userId ? challenge.partnerUserId : challenge.userId;

const acceptedAtOf = (challenge, userId) =>
  challenge.userId === userId ? challenge.userAcceptedAt : challenge.partnerAcceptedAt;

function assertParticipant(challenge, userId) {
  if (challenge.userId !== userId && challenge.partnerUserId !== userId) {
    throw new AppError("Forbidden", 403);
  }
}

/** Client-facing view of a challenge, from one participant's point of view. */
export function shapeChallenge(challenge, userId, now = Date.now()) {
  const paired = challenge.status === "ACCEPTED";
  return {
    id: challenge.id,
    status: challenge.status,
    accepted: Boolean(acceptedAtOf(challenge, userId)),
    partnerAccepted: Boolean(acceptedAtOf(challenge, otherParticipant(challenge, userId))),
    // Whoever accepted first shows the QR, the other one scans it.
    role: paired ? (challenge.qrHolderId === userId ? "SHOW_QR" : "SCAN") : null,
    // Remaining time relative to the server clock; clients count down from
    // "now" so a wrong phone clock can't make a pop-up open or close early.
    ttlMs: challenge.expiresAt ? Math.max(0, new Date(challenge.expiresAt).getTime() - now) : 0,
  };
}

// ── redis guard: only one matching round per interval ────────────────────

async function acquireRoundLock(roundIntervalMs) {
  if (!redis || typeof redis.set !== "function") return true;

  const slot = Math.floor(Date.now() / roundIntervalMs);
  try {
    const result = await redis.set(`social:round:${slot}`, "1", {
      nx: true,
      ex: Math.ceil((roundIntervalMs * 2) / 1000),
    });
    return result !== null && result !== undefined;
  } catch (err) {
    // Fail open (same policy as the rate limiter): a Redis outage must not
    // stop the feature. Worst case two rounds run; eligibility checks
    // (busy users are skipped) keep that harmless.
    logger.warn(`[social] Redis lock unavailable, running round without it: ${err.message}`);
    return true;
  }
}

async function releaseRoundLock(roundIntervalMs) {
  if (!redis || typeof redis.del !== "function") return;
  try {
    await redis.del(`social:round:${Math.floor(Date.now() / roundIntervalMs)}`);
  } catch {
    // best-effort
  }
}

// ── expiration ───────────────────────────────────────────────────────────

/** Marks timed-out realtime challenges EXPIRED and tells both people. */
export async function expireStaleChallenges(now = new Date()) {
  const stale = await prisma.socialChallenge.findMany({
    where: { isRealtime: true, status: { in: OPEN_STATUSES }, expiresAt: { lt: now } },
    select: { id: true, userId: true, partnerUserId: true },
    take: 200,
  });

  if (!stale?.length) return 0;

  await prisma.socialChallenge.updateMany({
    where: { id: { in: stale.map((c) => c.id) }, status: { in: OPEN_STATUSES } },
    data: { status: "EXPIRED" },
  });

  await publishToUsers(
    stale.flatMap((c) => [
      { userId: c.userId, event: "expired", data: { challengeId: c.id } },
      { userId: c.partnerUserId, event: "expired", data: { challengeId: c.id } },
    ])
  );

  return stale.length;
}

/** Expires one open challenge (e.g. somebody tried to scan after the 2 minutes) and tells both phones. */
export async function expireChallenge(challenge) {
  const res = await prisma.socialChallenge.updateMany({
    where: { id: challenge.id, status: { in: OPEN_STATUSES } },
    data: { status: "EXPIRED" },
  });
  if (res?.count) {
    await publishToUsers([
      { userId: challenge.userId, event: "expired", data: { challengeId: challenge.id } },
      { userId: challenge.partnerUserId, event: "expired", data: { challengeId: challenge.id } },
    ]);
  }
}

// ── matching round ───────────────────────────────────────────────────────

/**
 * Pairs everybody who is eligible right now. Called by the elected "leader"
 * client once per interval; safe to call from several clients (Redis lock).
 *
 * Eligible = in the Ably lobby (app open) AND has an open GymSession
 *            AND social interactions not disabled AND not already in a
 *            challenge AND is a member (not staff).
 *
 * Always 4 DB queries + 1-2 Ably calls, however many people are in the gym.
 */
export async function runMatchingRound(callerId) {
  const cfg = getSocialConfig();
  const now = new Date();

  // Only people who are inside the gym can trigger a round (anti-abuse).
  const callerSession = await prisma.gymSession.findFirst({
    where: { userId: callerId, checkOutAt: null },
    select: { id: true },
  });
  if (!callerSession) throw new AppError("You must be checked in to the gym", 403);

  if (!(await acquireRoundLock(cfg.roundIntervalMs))) {
    return { ran: false, paired: 0 };
  }

  try {
    await expireStaleChallenges(now);

    const lobbyIds = await getLobbyMemberIds();
    if (lobbyIds === null) {
      logger.warn("[social] Ably unavailable — skipping matching round");
      await releaseRoundLock(cfg.roundIntervalMs);
      return { ran: false, paired: 0 };
    }

    if (lobbyIds.length < 2) {
      await publishToLobby("round", { at: now.toISOString(), paired: 0 });
      return { ran: true, paired: 0 };
    }

    const cooldownStart = new Date(now.getTime() - cfg.pairCooldownMs);
    const involvesLobby = [{ userId: { in: lobbyIds } }, { partnerUserId: { in: lobbyIds } }];

    const [sessions, optedOut, open, recent] = await Promise.all([
      prisma.gymSession.findMany({
        where: {
          userId: { in: lobbyIds },
          checkOutAt: null,
          user: { role: "USER", isActive: true },
        },
        select: { userId: true },
      }),
      prisma.userSettings.findMany({
        where: { userId: { in: lobbyIds }, disableSocial: true },
        select: { userId: true },
      }),
      prisma.socialChallenge.findMany({
        // Legacy (non-realtime) rows are never shown to anybody anymore, so
        // they must not keep people out of the matching.
        where: { isRealtime: true, status: { in: OPEN_STATUSES }, expiresAt: { gt: now }, OR: involvesLobby },
        select: { userId: true, partnerUserId: true },
      }),
      prisma.socialChallenge.findMany({
        where: { isRealtime: true, createdAt: { gte: cooldownStart }, OR: involvesLobby },
        select: { userId: true, partnerUserId: true },
      }),
    ]);

    const excluded = new Set((optedOut ?? []).map((s) => s.userId));
    for (const c of open ?? []) {
      excluded.add(c.userId);
      excluded.add(c.partnerUserId);
    }
    const recentPairs = new Set((recent ?? []).map((c) => pairKey(c.userId, c.partnerUserId)));

    const eligible = shuffle(
      [...new Set((sessions ?? []).map((s) => s.userId))].filter((id) => !excluded.has(id))
    );

    // Greedy random pairing that avoids people who were just paired together.
    const pairs = [];
    const used = new Set();
    for (const a of eligible) {
      if (used.has(a)) continue;
      if (pairs.length >= MAX_PAIRS_PER_ROUND) break;
      const b = eligible.find((c) => c !== a && !used.has(c) && !recentPairs.has(pairKey(a, c)));
      if (!b) continue;
      used.add(a);
      used.add(b);
      pairs.push([a, b]);
    }

    if (pairs.length) {
      const expiresAt = new Date(now.getTime() + cfg.inviteTtlMs);
      const created = await Promise.all(
        pairs.map(([a, b]) =>
          prisma.socialChallenge.create({
            data: {
              userId: a,
              partnerUserId: b,
              status: "ASSIGNED",
              isRealtime: true,
              expiresAt,
            },
          })
        )
      );

      await publishToUsers(
        created.flatMap((c) => [
          { userId: c.userId, event: "invite", data: { challengeId: c.id, ttlMs: cfg.inviteTtlMs } },
          { userId: c.partnerUserId, event: "invite", data: { challengeId: c.id, ttlMs: cfg.inviteTtlMs } },
        ])
      );
    }

    await publishToLobby("round", { at: now.toISOString(), paired: pairs.length });
    return { ran: true, paired: pairs.length };
  } catch (err) {
    // Let another client retry within this same interval.
    await releaseRoundLock(cfg.roundIntervalMs);
    throw err;
  }
}

// ── answering the invitation ─────────────────────────────────────────────

/**
 * Yes/No from the first pop-up. "No" is the same as closing it (see
 * cancelChallenge). Idempotent: answering Yes twice is harmless.
 */
export async function respondToChallenge(userId, challengeId, accept) {
  if (!accept) return cancelChallenge(userId, challengeId);

  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || !challenge.isRealtime) throw new AppError("Challenge not found", 404);
  assertParticipant(challenge, userId);

  if (challenge.status === "ACCEPTED" && acceptedAtOf(challenge, userId)) {
    return shapeChallenge(challenge, userId); // already paired, just resync the client
  }
  if (challenge.status !== "ASSIGNED") {
    throw new AppError("This invitation is no longer open", 409);
  }

  const now = new Date();
  if (challenge.expiresAt && new Date(challenge.expiresAt) <= now) {
    await expireChallenge(challenge);
    throw new AppError("This invitation has expired", 410);
  }

  const field = challenge.userId === userId ? "userAcceptedAt" : "partnerAcceptedAt";
  const marked = await prisma.socialChallenge.updateMany({
    where: { id: challengeId, status: "ASSIGNED" },
    data: { [field]: challenge[field] ?? now },
  });
  if (!marked?.count) {
    // The other person cancelled/it expired in the meantime.
    const latest = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
    return shapeChallenge(latest ?? challenge, userId);
  }

  let current = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });

  if (current.userAcceptedAt && current.partnerAcceptedAt && current.status === "ASSIGNED") {
    const cfg = getSocialConfig();
    const first =
      new Date(current.userAcceptedAt) <= new Date(current.partnerAcceptedAt)
        ? current.userId
        : current.partnerUserId;

    // The status guard makes exactly one of two simultaneous "Yes" win.
    const paired = await prisma.socialChallenge.updateMany({
      where: { id: challengeId, status: "ASSIGNED" },
      data: {
        status: "ACCEPTED",
        pairedAt: now,
        qrHolderId: first,
        expiresAt: new Date(now.getTime() + cfg.qrTtlMs),
      },
    });

    current = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });

    if (paired?.count) {
      await publishToUsers(
        [current.userId, current.partnerUserId].map((id) => ({
          userId: id,
          event: "paired",
          data: shapeChallenge(current, id),
        }))
      );
    }
  }

  return shapeChallenge(current, userId);
}

// ── cancelling ───────────────────────────────────────────────────────────

/**
 * "No" / "cerrar" on any of the pop-ups (or leaving the gym mid-challenge).
 * Ends the challenge for both. Only the OTHER person gets points, and only
 * if they had accepted — a reduced amount (SOCIAL_CHALLENGE_ATTEMPTED)
 * compared to completing it (SOCIAL_CHALLENGE_COMPLETED).
 *
 * @param {object} [options]
 * @param {boolean} [options.strict] throw when it can't be cancelled (legacy
 *   challenges.service#rejectChallenge contract) instead of resolving quietly.
 */
export async function cancelChallenge(userId, challengeId, { strict = false } = {}) {
  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError("Challenge not found", 404);
  assertParticipant(challenge, userId);

  if (!OPEN_STATUSES.includes(challenge.status)) {
    if (strict) throw new AppError("Challenge cannot be cancelled in its current state", 400);
    return shapeChallenge(challenge, userId);
  }

  const res = await prisma.socialChallenge.updateMany({
    where: { id: challengeId, status: { in: OPEN_STATUSES } },
    data: { status: "REJECTED", cancelledById: userId },
  });
  if (!res?.count) {
    return shapeChallenge({ ...challenge, status: "REJECTED" }, userId);
  }

  const otherId = otherParticipant(challenge, userId);
  // Legacy rows (scan-user / old job) have no per-person timestamps: ACCEPTED
  // there already meant both agreed.
  const otherAccepted =
    Boolean(acceptedAtOf(challenge, otherId)) ||
    (!challenge.isRealtime && challenge.status === "ACCEPTED");

  let points = 0;
  if (otherAccepted) {
    try {
      await addPoints(otherId, POINTS.SOCIAL_CHALLENGE_ATTEMPTED, "Social interaction cancelled by partner");
      points = POINTS.SOCIAL_CHALLENGE_ATTEMPTED;
    } catch (err) {
      logger.error(`[social] Failed to award partial points: ${err.message}`);
    }
  }

  await publishToUsers([
    { userId: otherId, event: "cancelled", data: { challengeId, points } },
  ]);

  return { ...shapeChallenge({ ...challenge, status: "REJECTED" }, userId), points: 0 };
}

/**
 * Leaving the gym (exit QR) in the middle of an interaction cancels it, so the
 * other person isn't left waiting for somebody who is no longer there.
 */
export async function cancelOpenChallengesFor(userId) {
  const open = await prisma.socialChallenge.findMany({
    where: {
      isRealtime: true,
      status: { in: OPEN_STATUSES },
      OR: [{ userId }, { partnerUserId: userId }],
    },
    select: { id: true },
  });
  for (const { id } of open ?? []) {
    await cancelChallenge(userId, id);
  }
  return open?.length ?? 0;
}

// ── client bootstrap ─────────────────────────────────────────────────────

/**
 * Everything the app needs on start-up/reconnect, in ONE request:
 * am I in the gym, are interactions disabled, and is there a challenge in
 * progress that I should resume (e.g. the app was reopened mid-challenge).
 */
export async function getSocialState(userId) {
  const cfg = getSocialConfig();
  const now = new Date();

  const [session, settings, challenge] = await Promise.all([
    prisma.gymSession.findFirst({
      where: { userId, checkOutAt: null },
      select: { id: true },
    }),
    prisma.userSettings.findUnique({ where: { userId }, select: { disableSocial: true } }),
    prisma.socialChallenge.findFirst({
      where: {
        isRealtime: true,
        status: { in: OPEN_STATUSES },
        expiresAt: { gt: now },
        OR: [{ userId }, { partnerUserId: userId }],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    inGym: Boolean(session),
    disabled: Boolean(settings?.disableSocial),
    roundIntervalMs: cfg.roundIntervalMs,
    challenge: challenge ? shapeChallenge(challenge, userId, now.getTime()) : null,
  };
}

/** Ably TokenRequest for this user (clientId = userId, see realtime/ably.js). */
export async function getRealtimeToken(userId) {
  const tokenRequest = await createSocialTokenRequest(userId);
  if (!tokenRequest) throw new AppError("Realtime service unavailable", 503);
  return tokenRequest;
}
