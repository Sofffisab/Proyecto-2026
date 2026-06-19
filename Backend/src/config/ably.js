import Ably from "ably";

export const ABLY_CHANNELS = {
  PRESENCE: "presence",
  ASSISTANCE: "assistance",
  SOCIAL: "social",
  NOTIFICATIONS: "notifications",
};

// Raw REST client for callers that need it via config/index.js
export const ably = new Ably.Rest({
  key: process.env.ABLY_API_KEY,
});

export default ably;