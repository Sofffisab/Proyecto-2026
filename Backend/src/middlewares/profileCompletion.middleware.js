import prisma from "../config/prisma.js";
import redis from "../config/redis.js";
import { AppError } from "../utils/errors.js";

// Routes a member must still be able to reach even with an incomplete
// profile: finishing/editing the profile itself, session/account basics,
// and QR (so a first-time user can at least be identified at the front
// desk while completing onboarding).
const EXEMPT_PATH_PREFIXES = [
  "/auth",
  "/users/me",
  "/user/profile",
  "/notifications",
];

function isExemptPath(path) {
  return EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Required for a profile to be considered complete: medical info, birthday,
// and delivery address (needed to ship reward redemptions).
export function isProfileDataComplete(user) {
  return Boolean(user.birthday) && user.medicalConditions != null && Boolean(user.deliveryAddress);
}

// First-time-login lock: forces the member to fill in mandatory data
// (medical, birthday, address) and blocks the rest of the API until
// isProfileComplete = true. Only applies to regular members — trainers
// and admins are never blocked by this.
export async function requireCompleteProfile(req, res, next) {
  try {
    if (!req.user) return next();
    if (req.user.role !== "USER") return next();
    if (isExemptPath(req.path)) return next();

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, birthday: true, medicalConditions: true, deliveryAddress: true, isProfileComplete: true },
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
        message:
          "Debes completar tu perfil (datos médicos, fecha de nacimiento y dirección) antes de continuar.",
      });
    }

    next();
  } catch (err) {
    next(err);
  }
}
