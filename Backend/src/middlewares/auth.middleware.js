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

    // Try to get user from Redis cache first (60 second TTL)
    let user = null;
    if (redis) {
      const cacheKey = `user:${payload.userId}`;
      const cachedUser = await redis.get(cacheKey);
      if (cachedUser) {
        user = JSON.parse(cachedUser);
      }
    }

    // If not in cache, fetch from database
    if (!user) {
      user = await prisma.user.findUnique({ where: { id: payload.userId } });

      if (user && redis) {
        // Cache for 60 seconds
        await redis.setex(`user:${payload.userId}`, 60, JSON.stringify(user));
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

