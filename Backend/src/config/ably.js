import Ably from "ably";

export const ably = new Ably.Rest({
  key: process.env.ABLY_API_KEY,
});

export const ABLY_CHANNELS = {
  PRESENCE: "presence",
  ASSISTANCE: "assistance",
  SOCIAL: "social",
  NOTIFICATIONS: "notifications",
};

export default ably;