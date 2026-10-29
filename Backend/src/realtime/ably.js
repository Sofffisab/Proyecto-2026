import Ably from "ably";
import { logger } from "../utils/logger.js";

let ably = null;

const channels = {
  presence: null,
  assistance: null,
  social: null,
  notifications: null,
};

try {
  if (!process.env.ABLY_API_KEY) {
    throw new Error("ABLY_API_KEY is not set");
  }

  ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });

  channels.presence      = ably.channels.get("presence");
  channels.assistance    = ably.channels.get("assistance");
  channels.social        = ably.channels.get("social");
  channels.notifications = ably.channels.get("notifications");

  logger.info("[ably] Rest client initialized for Serverless events");
} catch (err) {
  logger.warn("[ably] Realtime/Rest unavailable — running without Ably:", err.message);
}

export { channels };

function safePublish(channel, event, data) {
  if (!channel) {
    logger.warn(`[ably] Skipping publish "${event}" — channel not available`);
    return;
  }
  channel.publish(event, data);
}

export function emitPresenceEvent(event, data) {
  safePublish(channels.presence, event, data);
}

export function emitAssistanceEvent(event, data) {
  safePublish(channels.assistance, event, data);
}

export function emitSocialEvent(event, data) {
  safePublish(channels.social, event, data);
}

export function emitNotificationEvent(data) {
  safePublish(channels.notifications, "GENERIC_NOTIFICATION", data);
}

export function emitUserNeedsAttention(userId, lastAssistanceAt, minutesWithoutAssistance) {
  safePublish(channels.assistance, "USER_NEEDS_ATTENTION", {
    userId,
    lastAssistanceAt,
    minutesWithoutAssistance,
  });
}

// ── Social interactions ("¿Querés hacer un amigo?") ─────────────────────────
//
// Channel layout (see services/social.service.js and Frontend/social/):
//   social:lobby         presence = everybody who is in the gym with the app
//                        open; also carries the `round` announcement.
//   social:user:<userId> private inbox of one person: invite / paired /
//                        completed / cancelled / expired.
//
// Clients can ONLY subscribe (never publish) and only to the lobby and their
// own inbox — every message is published by this backend, so nobody can fake
// an invitation or a "completed" for someone else.

export const SOCIAL_LOBBY_CHANNEL = "social:lobby";
export const socialUserChannel = (userId) => `social:user:${userId}`;

// One hour: ably-js asks the app for a new token before it expires.
const SOCIAL_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Ably TokenRequest for one person, or null when Ably is not configured. */
export async function createSocialTokenRequest(userId) {
  if (!ably) return null;
  try {
    return await ably.auth.createTokenRequest({
      clientId: userId,
      ttl: SOCIAL_TOKEN_TTL_MS,
      capability: JSON.stringify({
        [SOCIAL_LOBBY_CHANNEL]: ["subscribe", "presence"],
        [socialUserChannel(userId)]: ["subscribe"],
      }),
    });
  } catch (err) {
    logger.error(`[ably] Could not create a token request: ${err.message}`);
    return null;
  }
}

/**
 * Sends per-user messages in ONE Ably request, however many people there are.
 * Never throws: a lost push must not fail the HTTP request that caused it
 * (clients resync with GET /social/state when they reconnect).
 *
 * @param {Array<{userId: string, event: string, data?: object}>} messages
 */
export async function publishToUsers(messages) {
  if (!messages?.length) return;
  if (!ably) {
    logger.warn("[ably] Skipping user pushes — Ably not available");
    return;
  }
  try {
    await ably.batchPublish(
      messages.map(({ userId, event, data }) => ({
        channels: [socialUserChannel(userId)],
        messages: [{ name: event, data: data ?? {} }],
      }))
    );
  } catch (err) {
    logger.error(`[ably] Batch publish failed: ${err.message}`);
  }
}

export async function publishToLobby(event, data) {
  if (!ably) return;
  try {
    await ably.channels.get(SOCIAL_LOBBY_CHANNEL).publish(event, data);
  } catch (err) {
    logger.error(`[ably] Lobby publish failed: ${err.message}`);
  }
}

/**
 * Ids of everybody present in the lobby right now (= app open in the gym),
 * or null when Ably can't be reached so the caller can skip the round.
 */
export async function getLobbyMemberIds() {
  if (!ably) return null;
  try {
    const ids = new Set();
    let page = await ably.channels.get(SOCIAL_LOBBY_CHANNEL).presence.get({ limit: 1000 });
    while (page) {
      for (const member of page.items ?? []) ids.add(member.clientId);
      page = page.hasNext() ? await page.next() : null;
    }
    return [...ids];
  } catch (err) {
    logger.error(`[ably] Could not read lobby presence: ${err.message}`);
    return null;
  }
}
