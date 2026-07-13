import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { AppError } from "../utils/errors.js";
import { MESSAGES } from "../locales/es.js";

// Routes a member must still be able to reach even with an incomplete
// profile: finishing/editing the profile itself, session/account basics,
// and QR (so a first-time user can at least be identified at the front
// desk while completing onboarding).
const EXEMPT_PATH_PREFIXES = [
  "/auth",
  "/users/me",
  "/user/profile",
  "/notifications",
  "/rewards",
  "/gym",
  "/gamification",
  "/challenges",
  "/routines",
  "/sync",
  "/qr",
  "/complaints",
  "/assistance",
  "/analytics",
];

function isExemptPath(req) {
  // NOTE: this middleware is mounted via `router.use(PROTECTED_PREFIXES, ...)`
  // with an array of path prefixes. Express strips the matched prefix from
  // req.url/req.path for prefix-style `use()` mounts, so req.path here is
  // NOT the original request path (e.g. "/users/me" arrives as just "/me").
  // Use the original URL instead, and strip any versioned API prefix the
  // app also mounts the router under (see server.js: "/api/v1" and "/").
  let path = (req.originalUrl || req.path || "").split("?")[0];
  if (path.startsWith("/api/v1")) path = path.slice("/api/v1".length);
  return EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Required for a profile to be considered complete: medical info, birthday,
// delivery address (needed to ship reward redemptions), and the 4 pantalla U
// fields (main goal, current level, weekly training days,
// tipo de entrenamiento buscado) — without these, goal-progress/insights and
// trainer-matching logic can't run for the user (see insights.service.js
// and gym.service.js#studentGoalTypes).
export function isProfileDataComplete(user) {
  return (
    Boolean(user.birthday) &&
    user.medicalConditions != null &&
    Boolean(user.deliveryAddress) &&
    Boolean(user.trainingLevel) &&
    Array.isArray(user.objectives) &&
    user.objectives.length > 0 &&
    Boolean(user.weeklyTrainingDays) &&
    Boolean(user.trainingType)
  );
}

// First-time-login lock: forces the member to fill in mandatory data
// (medical, birthday, address, and the pantalla U fields) and blocks the
// rest of the API until isProfileComplete = true. Only applies to regular
// members — trainers and admins are never blocked by this.
export async function requireCompleteProfile(req, res, next) {
  try {
    if (!req.user) return next();
    if (req.user.role !== "USER") return next();
    if (isExemptPath(req)) return next();

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        birthday: true,
        medicalConditions: true,
        deliveryAddress: true,
        trainingLevel: true,
        objectives: true,
        weeklyTrainingDays: true,
        trainingType: true,
        isProfileComplete: true,
      },
    });

    if (!user) throw new AppError("User not found", 404);

    const complete = isProfileDataComplete(user);

    // Keep the persisted flag in sync, lazily, the moment we notice it's stale.
    if (complete !== user.isProfileComplete) {
      await prisma.user.update({ where: { id: user.id }, data: { isProfileComplete: complete } });
      if (redis) await redis.del(`user:${user.id}`);
    }

    if (!complete) {
      return res.status(403).json({
        success: false,
        code: "PROFILE_INCOMPLETE",
        message: MESSAGES.PROFILE_INCOMPLETE,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}
