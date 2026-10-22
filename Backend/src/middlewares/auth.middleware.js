import jwt from "jsonwebtoken";
import { prisma, redis } from "../config/index.js";
import { logger } from "../utils/logger.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    // Check token blacklist in Redis (logout invalidation)
    // Fail open if Redis is unreachable: a Redis outage must not turn every
    // authenticated request into a 401 (the JWT signature is still verified).
    if (redis) {
      let isBlacklisted = null;
      try {
        isBlacklisted = await redis.get(`blacklist:${token}`);
      } catch (redisErr) {
        logger.warn(`[auth] Redis blacklist check failed: ${redisErr.message}`);
      }
      if (isBlacklisted) {
        return res.status(401).json({ success: false, message: "Token has been revoked" });
      }
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Read payload.userId (matches how the token is signed)
    const cacheKey = `user:${payload.userId}`;

    let user = null;
    if (redis) {
      try {
        const cachedUser = await redis.get(cacheKey);
        if (cachedUser) {
          user = typeof cachedUser === "string" ? JSON.parse(cachedUser) : cachedUser;
        }
      } catch (redisErr) {
        logger.warn(`[auth] Redis user cache read failed: ${redisErr.message}`);
      }
    }

    if (!user) {
      // Never cache/propagate password or reset-token fields on req.user.
      user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });

      if (user && redis) {
        try {
          await redis.setex(cacheKey, 60, JSON.stringify(user));
        } catch (redisErr) {
          logger.warn(`[auth] Redis user cache write failed: ${redisErr.message}`);
        }
      }
    }

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
