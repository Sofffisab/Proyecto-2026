import Ably from "ably";
import { logger } from "../utils/logger.js";

export const ABLY_CHANNELS = {
  PRESENCE: "presence",
  ASSISTANCE: "assistance",
  SOCIAL: "social",
  NOTIFICATIONS: "notifications",
};

// REST client with optional initialization
let ably = null;

try {
  if (!process.env.ABLY_API_KEY) {
    throw new Error("ABLY_API_KEY is not set");
  }

  ably = new Ably.Rest({ key: process.env.ABLY_API_KEY });
  logger.info("[ably] REST client initialized");
} catch (err) {
  logger.warn("[ably] REST client unavailable:", err.message);
}

export { ably };
export default ably;