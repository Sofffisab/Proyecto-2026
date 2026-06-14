import Ably from "ably";

const ably = new Ably.Realtime({
  key: process.env.ABLY_API_KEY,
});

/**
 * Channels centralizados del sistema
 */
export const channels = {
  presence: ably.channels.get("presence"),
  assistance: ably.channels.get("assistance"),
  social: ably.channels.get("social"),
  notifications: ably.channels.get("notifications"),
};

/**
 * PRESENCE EVENTS
 */
export function emitPresenceEvent(event, data) {
  channels.presence.publish(event, data);
}

/**
 * ASSISTANCE EVENTS
 */
export function emitAssistanceEvent(event, data) {
  channels.assistance.publish(event, data);
}

/**
 * SOCIAL EVENTS
 */
export function emitSocialEvent(event, data) {
  channels.social.publish(event, data);
}

/**
 * NOTIFICATIONS EVENTS
 */
export function emitNotificationEvent(data) {
  channels.notifications.publish("GENERIC_NOTIFICATION", data);
}

export default ably;