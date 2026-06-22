import Ably from "ably";

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

  ably = new Ably.Realtime({ key: process.env.ABLY_API_KEY });

  channels.presence      = ably.channels.get("presence");
  channels.assistance    = ably.channels.get("assistance");
  channels.social        = ably.channels.get("social");
  channels.notifications = ably.channels.get("notifications");

  console.log("[ably] Realtime connected");
} catch (err) {
  console.warn("[ably] Realtime unavailable — running without Ably:", err.message);
}

export { channels };

function safePublish(channel, event, data) {
  if (!channel) {
    console.warn(`[ably] Skipping publish "${event}" — channel not available`);
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

/**
 * Emits a USER_NEEDS_ATTENTION event on the assistance channel so that
 * connected trainers are notified in real-time when a user has been present
 * in the gym for a long time without receiving assistance.
 *
 * Call this from the gym service (e.g. inside getPresentUsers) or from a
 * periodic job after calculating lastAssistanceAt for each present user.
 *
 * @param {string} userId
 * @param {Date|null} lastAssistanceAt - timestamp of the last completed assistance, or null
 * @param {number} minutesWithoutAssistance - how many minutes the user has been waiting
 */
export function emitUserNeedsAttention(userId, lastAssistanceAt, minutesWithoutAssistance) {
  safePublish(channels.assistance, "USER_NEEDS_ATTENTION", {
    userId,
    lastAssistanceAt,
    minutesWithoutAssistance,
    detectedAt: new Date(),
  });
}

export default ably;