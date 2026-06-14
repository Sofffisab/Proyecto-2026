import jwt from "jsonwebtoken";

import { prisma } from "../config/prisma.js";

export const authenticate = async (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token =
      authHeader.split(" ")[1];

    const payload = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    const user =
      await prisma.user.findUnique({
        where: {
          id: payload.userId,
        },
        include: {
          trainerProfile: true,
          settings: true,
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account disabled",
      });
    }

    req.user = user;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

export default authenticate;