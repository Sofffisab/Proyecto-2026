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
 * requireActiveAccount is intentionally a pass-through here.
 * The isActive check is already performed inside `authenticate` above.
 * This export exists solely so that routes/index.js can import it
 * without changes; the real guard lives in deactivation.middleware.js
 * which is also applied via router.use().
 */
export const requireActiveAccount = (req, res, next) => next();