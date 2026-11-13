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
import { calculateAge } from "../utils/age.js";
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
    // Cooldown between pairing the same two people again: none (0).
    // Set SOCIAL_PAIR_COOLDOWN_MS > 0 to bring it back.
    pairCooldownMs: Math.max(0, parseInt(process.env.SOCIAL_PAIR_COOLDOWN_MS ?? "", 10) || 0),
    // "Filtrar a personas de mi rango de edad": max age difference, in years.
    ageRangeYears: int("SOCIAL_AGE_RANGE_YEARS", 5),
  };
}

// ── helpers ──────────────────────────────────────────────────────────────

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Does `other` satisfy the social filters that `me` set in Settings?
 * `me` / `other` are { gender, birthday, sameGenderOnly, sameAgeRangeOnly }.
 *
 *  - sameGenderOnly: both genders must be known, and equal. Someone who did
 *    not say their gender (null / PREFER_NOT_TO_SAY) can't be matched by it.
 *  - sameAgeRangeOnly: both ages must be known and differ by at most
 *    `ageRangeYears`.
 */
export function satisfiesFilters(me, other, ageRangeYears = 5) {
  if (me.sameGenderOnly) {
    const known = (g) => Boolean(g) && g !== "PREFER_NOT_TO_SAY";
    if (!known(me.gender) || !known(other.gender) || me.gender !== other.gender) return false;
  }

  if (me.sameAgeRangeOnly) {
    const myAge = calculateAge(me.birthday);
    const otherAge = calculateAge(other.birthday);
    if (myAge == null || otherAge == null || Math.abs(myAge - otherAge) > ageRangeYears) return false;
  }

  return true;
}

/**
 * Can these two people be paired? Filters are mutual (each one's filters must
 * be met by the other) and a block by either side rules the pair out.
 *
 * @param {object} a  profile of person A (see satisfiesFilters)
 * @param {object} b  profile of person B
 * @param {object} [ctx]
 * @param {boolean} [ctx.blocked]  A blocked B or B blocked A
 * @param {number} [ctx.ageRangeYears]
 */
export function canPair(a, b, { blocked = false, ageRangeYears = 5 } = {}) {
  if (blocked) return false;
  return satisfiesFilters(a, b, ageRangeYears) && satisfiesFilters(b, a, ageRangeYears);
}

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
export function shapeChallenge(challenge, userId, now = Date.now(), partner = null) {
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
    // Who is on the other side (only sent once paired, see loadPartnerCard).
    ...(partner ? { partner } : {}),
  };
}

const AGE_BUCKET_YEARS = 5;

/** "25 - 29" style bucket instead of the exact age (privacy). */
export function ageBucket(birthday, now = new Date()) {
  const age = calculateAge(birthday, now);
  if (age == null || age < 0) return null;
  const from = Math.floor(age / AGE_BUCKET_YEARS) * AGE_BUCKET_YEARS;
  return { from, to: from + AGE_BUCKET_YEARS - 1 };
}

/**
 * What the pop-up shows about the person you were paired with: first name, the
 * machine they are using right now, and a small public profile. Sent ONLY to
 * the two participants and only after both said Yes, inside the `paired` event
 * / the respond answer / GET /social/state — so it costs no extra request.
 * Best-effort: any failure just means the pop-up shows less.
 */
export async function loadPartnerCard(challenge, userId) {
  try {
    const partnerId = otherParticipant(challenge, userId);
    const p = await prisma.user.findUnique({
      where: { id: partnerId },
      select: {
        firstName: true,
        birthday: true,
        trainingLevel: true,
        trainingType: true,
        objectives: true,
        settings: { select: { machineTrackingOptOut: true } },
        machineUsages: {
          where: { endedAt: null, startedAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { machine: { select: { name: true } } },
        },
        _count: { select: { achievements: true } },
      },
    });
    if (!p) return null;
    const trackingOff = Boolean(p.settings?.machineTrackingOptOut);
    return {
      name: p.firstName ?? "",
      machine: trackingOff ? null : p.machineUsages?.[0]?.machine?.name ?? null,
      level: p.trainingLevel ?? null,
      interests: p.trainingType ? [p.trainingType] : [],
      goals: p.objectives ?? [],
      achievements: p._count?.achievements ?? 0,
      ageRange: ageBucket(p.birthday),
    };
  } catch (err) {
    logger.warn(`[social] Could not load partner card: ${err.message}`);
    return null;
  }
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
 * Always 5 DB queries + 1-2 Ably calls, however many people are in the gym.
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

    const [sessions, settingsRows, blocks, open, recent] = await Promise.all([
      prisma.gymSession.findMany({
        where: {
          userId: { in: lobbyIds },
          checkOutAt: null,
          user: { role: "USER", isActive: true },
        },
        select: { userId: true, user: { select: { gender: true, birthday: true } } },
      }),
      // Only people who changed something from the defaults have a row that matters.
      prisma.userSettings.findMany({
        where: {
          userId: { in: lobbyIds },
          OR: [{ disableSocial: true }, { socialSameGenderOnly: true }, { socialSameAgeRangeOnly: true }],
        },
        select: {
          userId: true,
          disableSocial: true,
          socialSameGenderOnly: true,
          socialSameAgeRangeOnly: true,
        },
      }),
      // "Bloquear persona x": a block by either side keeps the two apart.
      prisma.userBlock.findMany({
        where: { OR: [{ blockerId: { in: lobbyIds } }, { blockedId: { in: lobbyIds } }] },
        select: { blockerId: true, blockedId: true },
      }),
      prisma.socialChallenge.findMany({
        // Legacy (non-realtime) rows are never shown to anybody anymore, so
        // they must not keep people out of the matching.
        where: { isRealtime: true, status: { in: OPEN_STATUSES }, expiresAt: { gt: now }, OR: involvesLobby },
        select: { userId: true, partnerUserId: true },
      }),
      cfg.pairCooldownMs > 0
        ? prisma.socialChallenge.findMany({
            where: { isRealtime: true, createdAt: { gte: cooldownStart }, OR: involvesLobby },
            select: { userId: true, partnerUserId: true },
          })
        : Promise.resolve([]),
    ]);

    const settingsByUser = new Map((settingsRows ?? []).map((row) => [row.userId, row]));
    const blockedPairs = new Set((blocks ?? []).map((b) => pairKey(b.blockerId, b.blockedId)));

    const excluded = new Set((settingsRows ?? []).filter((s) => s.disableSocial).map((s) => s.userId));
    for (const c of open ?? []) {
      excluded.add(c.userId);
      excluded.add(c.partnerUserId);
    }
    const recentPairs = new Set((recent ?? []).map((c) => pairKey(c.userId, c.partnerUserId)));

    // Everything canPair() needs about each person, from the queries above.
    const profiles = new Map();
    for (const s of sessions ?? []) {
      const settings = settingsByUser.get(s.userId);
      profiles.set(s.userId, {
        gender: s.user?.gender ?? null,
        birthday: s.user?.birthday ?? null,
        sameGenderOnly: Boolean(settings?.socialSameGenderOnly),
        sameAgeRangeOnly: Boolean(settings?.socialSameAgeRangeOnly),
      });
    }

    const eligible = shuffle(
      [...new Set((sessions ?? []).map((s) => s.userId))].filter((id) => !excluded.has(id))
    );

    // Greedy random pairing that avoids people who were just paired together,
    // blocked people and anybody who doesn't meet the other's filters.
    const pairs = [];
    const used = new Set();
    for (const a of eligible) {
      if (used.has(a)) continue;
      if (pairs.length >= MAX_PAIRS_PER_ROUND) break;
      const b = eligible.find(
        (c) =>
          c !== a &&
          !used.has(c) &&
          !recentPairs.has(pairKey(a, c)) &&
          canPair(profiles.get(a) ?? {}, profiles.get(c) ?? {}, {
            blocked: blockedPairs.has(pairKey(a, c)),
            ageRangeYears: cfg.ageRangeYears,
          })
      );
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
      const ids = [current.userId, current.partnerUserId];
      const cards = await Promise.all(ids.map((id) => loadPartnerCard(current, id)));
      await publishToUsers(
        ids.map((id, i) => ({
          userId: id,
          event: "paired",
          data: shapeChallenge(current, id, Date.now(), cards[i]),
        }))
      );
    }
  }

  const card = current.status === "ACCEPTED" ? await loadPartnerCard(current, userId) : null;
  return shapeChallenge(current, userId, Date.now(), card);
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
    challenge: challenge
      ? shapeChallenge(
          challenge,
          userId,
          now.getTime(),
          challenge.status === "ACCEPTED" ? await loadPartnerCard(challenge, userId) : null
        )
      : null,
  };
}

// ── feedback after completing ────────────────────────────────────────────

/**
 * "¿Cómo fue tu experiencia?" after a completed interaction: optional 1-5
 * stars, optional thumbs up/down and an optional report of the other person.
 * One feedback per person per interaction (a repeat is ignored). A report is
 * stored as a regular MEMBER_MISCONDUCT denuncia, so admins see it with the
 * ones that come from the exit pop-up.
 */
export async function submitFeedback(userId, challengeId, { rating, liked, report } = {}) {
  const challenge = await prisma.socialChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new AppError("Challenge not found", 404);
  assertParticipant(challenge, userId);
  if (challenge.status !== "COMPLETED") {
    throw new AppError("Only completed interactions can be rated", 400);
  }

  try {
    await prisma.socialFeedback.create({
      data: {
        challengeId,
        userId,
        rating: rating ?? null,
        liked: liked ?? null,
        reported: Boolean(report),
      },
    });
  } catch (err) {
    if (err?.code === "P2002") return { saved: false }; // already sent once
    throw err;
  }

  if (report) {
    try {
      await prisma.denuncia.create({
        data: {
          reporterId: userId,
          type: "MEMBER_MISCONDUCT",
          reportedUserId: otherParticipant(challenge, userId),
          comment: `Social interaction ${challengeId}`,
        },
      });
    } catch (err) {
      logger.error(`[social] Failed to store the report: ${err.message}`);
    }
  }

  return { saved: true };
}

/** Ably TokenRequest for this user (clientId = userId, see realtime/ably.js). */
export async function getRealtimeToken(userId) {
  const tokenRequest = await createSocialTokenRequest(userId);
  if (!tokenRequest) throw new AppError("Realtime service unavailable", 503);
  return tokenRequest;
}