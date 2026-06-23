import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import redis from "../config/redis.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    // Check token blacklist in Redis (logout invalidation)
    if (redis) {
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ success: false, message: "Token has been revoked" });
      }
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Account disabled" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

/**
 * @deprecated — DO NOT USE in new routes.
 *
 * requireActiveAccount is a no-op pass-through.
 *
 * Account activation is already enforced in two places:
 *   1. `authenticate` above: rejects any request with isActive === false.
 *   2. `deactivation.middleware.js`: applied globally via router.use() in
 *      routes/index.js for an extra layer.
 *
 * This export exists only for backward compatibility so existing imports
 * don't break. It must never be the sole guard on a route — it does nothing.
 *
 * Bug 25 fix: the duplication is intentional; this stub is kept to avoid
 * a breaking refactor, but is clearly documented as non-functional.
 */
export const requireActiveAccount = (_req, _res, next) => next();