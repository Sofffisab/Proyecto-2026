import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts",
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // After authenticate runs, key on the user ID so limits are per-user
  // not per-IP (prevents shared-IP abuse and unfair blocking)
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    message: "Too many requests",
  },
});

export default {
  authRateLimiter,
  apiRateLimiter,
};