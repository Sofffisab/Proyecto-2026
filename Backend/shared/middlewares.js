import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma.js";
import { ROLES, ERROR_CODES } from "./utils.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// ============ AUTHENTICATION MIDDLEWARE ============
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      req.userRole = decoded.role;
      next();
    } catch (error) {
      return res.status(401).json({
        error: "Invalid or expired token",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }
  } catch (error) {
    console.error("[MIDDLEWARE] Auth error:", error);
    return res.status(500).json({
      error: "Authentication failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ ROLE MIDDLEWARE ============
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({
        error: "Authentication required",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    next();
  };
};

// ============ SELF OR ADMIN MIDDLEWARE ============
export const requireSelfOrAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.userId === userId || req.userRole === ROLES.ADMIN) {
      return next();
    }

    return res.status(403).json({
      error: "Not authorized to access this resource",
      code: ERROR_CODES.FORBIDDEN,
    });
  } catch (error) {
    console.error("[MIDDLEWARE] Self or admin error:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ SELF OR TRAINER MIDDLEWARE ============
export const requireSelfOrTrainer = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (
      req.userId === userId ||
      req.userRole === ROLES.TRAINER ||
      req.userRole === ROLES.ADMIN
    ) {
      return next();
    }

    return res.status(403).json({
      error: "Not authorized to access this resource",
      code: ERROR_CODES.FORBIDDEN,
    });
  } catch (error) {
    console.error("[MIDDLEWARE] Self or trainer error:", error);
    return res.status(500).json({
      error: "Authorization check failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ PROFILE COMPLETE MIDDLEWARE ============
export const requireProfileComplete = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    if (!user.profileComplete) {
      return res.status(403).json({
        error: "Profile must be completed first",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    next();
  } catch (error) {
    console.error("[MIDDLEWARE] Profile complete error:", error);
    return res.status(500).json({
      error: "Profile check failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// ============ ERROR HANDLER MIDDLEWARE ============
export const errorHandler = (err, req, res, next) => {
  console.error("[ERROR]", err);

  // Prisma errors
  if (err.code === "P2002") {
    return res.status(409).json({
      error: "A record with this data already exists",
      code: ERROR_CODES.DUPLICATE_ENTRY,
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      error: "Record not found",
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      error: "Invalid token",
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      error: "Token expired",
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: err.message,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  // Default error
  return res.status(500).json({
    error: "Internal server error",
    code: ERROR_CODES.INTERNAL_ERROR,
  });
};

// ============ NOT FOUND HANDLER ============
export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    error: "Route not found",
    code: ERROR_CODES.NOT_FOUND,
  });
};

// ============ SETUP FUNCTION ============
const setupMiddlewares = () => {
  return {
    requireAuth,
    requireRole,
    requireSelfOrAdmin,
    requireSelfOrTrainer,
    requireProfileComplete,
    errorHandler,
    notFoundHandler,
  };
};

export default setupMiddlewares;