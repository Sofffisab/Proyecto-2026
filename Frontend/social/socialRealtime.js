// src/social/socialRealtime.js
//
// The realtime side of the social interactions, with NO React and NO direct
// dependency on the Ably package (the client is injected), so it can be
// reasoned about and tested on its own.
//
// What it does while the person is inside the gym (between the entry QR scan
// and the exit QR scan) with social interactions enabled:
//
//   1. Enters the Ably "social:lobby" presence. That is how the backend knows
//      who is in the app right now — no heartbeat requests of our own.
//   2. Listens on the private channel "social:user:<id>" for everything that
//      happens to this person (invite, paired, completed, cancelled, expired).
//   3. Takes part in a tiny leader election so that the WHOLE gym makes just
//      ONE request per round instead of one per person:
//        - the lowest clientId in the lobby is the leader and asks the server
//          to run a matching round at the start of every interval;
//        - everybody else only steps in as a fallback (a few seconds later)
//          if they did not see the server announce that the round happened,
//          e.g. because the leader's phone went to sleep.
//      The server has its own lock per interval, so even if several clients
//      do call it, only one round runs.
//   4. Never calls the server at all when you're alone in the lobby.

export const LOBBY_CHANNEL = 'social:lobby';
export const userChannel = (userId) => `social:user:${userId}`;

const LEADER_JITTER_MS = 1500;
const FALLBACK_AFTER_MS = 20000;
const FALLBACK_JITTER_MS = 8000;

/**
 * @param {object}   options
 * @param {string}   options.userId
 * @param {function} options.createClient  () => Ably.Realtime-like client
 * @param {function} options.tick          () => Promise — POST /social/tick
 * @param {function} options.onEvent       (name, data) => void
 * @param {function} [options.onReconnect] called when the connection comes back
 *                                          after having been lost
 * @param {number}   options.roundIntervalMs
 * @param {object}   [options.clock]       injectable for tests
 */
export function createSocialRealtime({
  userId,
  createClient,
  tick,
  onEvent,
  onReconnect,
  roundIntervalMs,
  clock = {},
}) {
  const now = clock.now ?? (() => Date.now());
  const setTimer = clock.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = clock.clearTimeout ?? ((id) => clearTimeout(id));
  const random = clock.random ?? Math.random;

  let client = null;
  let lobby = null;
  let stopped = true;
  let timers = [];
  let memberIds = [];
  let lastRoundAt = 0;
  let hasConnectedBefore = false;

  const isLeader = () => memberIds.length > 0 && memberIds[0] === userId;

  async function refreshMembers() {
    if (!lobby || stopped) return;
    try {
      const members = await lobby.presence.get();
      memberIds = [...new Set((members ?? []).map((m) => m.clientId))].sort();
    } catch {
      // keep the last known list
    }
  }

  function roundSeenRecently() {
    return lastRoundAt > 0 && now() - lastRoundAt < roundIntervalMs * 0.75;
  }

  async function maybeTick(role) {
    if (stopped) return;
    if (roundSeenRecently()) return; // the server already announced this round
    if (role === 'leader' && !isLeader()) return;
    if (memberIds.length < 2) return; // nobody to pair me with: don't bother the server

    try {
      const res = await tick();
      if (res?.data?.ran) lastRoundAt = now();
    } catch {
      // Silent: the fallback timers (mine and everybody else's) will retry.
    }
  }

  function scheduleCycle() {
    if (stopped) return;

    const t = now();
    const nextSlot = (Math.floor(t / roundIntervalMs) + 1) * roundIntervalMs;
    const untilSlot = nextSlot - t;

    const fallbackAfter = Math.min(FALLBACK_AFTER_MS, roundIntervalMs * 0.2);
    const fallbackJitter = Math.min(FALLBACK_JITTER_MS, roundIntervalMs * 0.1);

    timers.push(
      setTimer(() => maybeTick('leader'), untilSlot + random() * LEADER_JITTER_MS),
      setTimer(() => {
        maybeTick('fallback');
        timers = [];
        scheduleCycle();
      }, untilSlot + fallbackAfter + random() * fallbackJitter)
    );
  }

  function start() {
    if (!stopped) return;
    stopped = false;

    client = createClient();
    lobby = client.channels.get(LOBBY_CHANNEL);
    const mine = client.channels.get(userChannel(userId));

    mine.subscribe((message) => {
      try {
        onEvent(message.name, message.data ?? {});
      } catch {
        // a bad handler must never break the subscription
      }
    });

    lobby.subscribe('round', () => {
      lastRoundAt = now();
    });

    lobby.presence.subscribe(() => {
      refreshMembers();
    });

    lobby.presence
      .enter({ inGym: true })
      .then(refreshMembers)
      .catch(() => {});

    client.connection.on('connected', () => {
      if (hasConnectedBefore && onReconnect) onReconnect();
      hasConnectedBefore = true;
    });

    scheduleCycle();
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    timers.forEach((id) => clearTimer(id));
    timers = [];

    try {
      lobby?.presence.leave().catch(() => {});
      client?.close();
    } catch {
      // closing is best-effort
    }
    client = null;
    lobby = null;
    memberIds = [];
  }

  return { start, stop, isLeader, getMemberIds: () => [...memberIds] };
}
