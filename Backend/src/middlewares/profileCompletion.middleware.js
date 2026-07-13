import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { AppError } from "../utils/errors.js";
import { MESSAGES } from "../locales/es.js";

// Routes a member with an incomplete profile can still reach (onboarding, session, QR ID)
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
  // Express strips the matched prefix from req.path on prefix-style use(),
  // so we need the original URL instead, minus any "/api/v1" version prefix
  let path = (req.originalUrl || req.path || "").split("?")[0];
  if (path.startsWith("/api/v1")) path = path.slice("/api/v1".length);
  return EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Required for a complete profile: medical info, birthday, delivery address,
// and the 4 onboarding fields (goal, level, weekly days, training type)
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

// Blocks the API until the member's profile is complete (members only, not staff)
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

    // Lazily sync the persisted flag once it's noticed stale
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
