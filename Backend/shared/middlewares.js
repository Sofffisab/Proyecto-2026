import jwt from "jsonwebtoken";
import { prisma } from "../prisma/prisma.js";
import { ROLES, ERROR_CODES } from "./utils.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is required");
}

// ============ AUTH MIDDLEWARE ============

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Token expired",
          code: ERROR_CODES.UNAUTHORIZED,
        });
      }
      return res.status(401).json({
        error: "Invalid token",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        role: true,
        photoUrl: true,
        profileComplete: true,
        accountPaused: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "User not found",
        code: ERROR_CODES.USER_NOT_FOUND,
      });
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        error: "Token has been invalidated",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }


    if (user.accountPaused) {
      return res.status(403).json({
        error: "Account is paused",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    const emailVerificationWhitelist = [
      '/api/auth/verify-email',
      '/api/auth/logout'
    ];

    const currentPath = req.path;
    const isWhitelisted = emailVerificationWhitelist.some(path => 
      currentPath.startsWith(path)
    );

    if (!user.emailVerified && !isWhitelisted) {
      return res.status(403).json({
        error: "Email verification required",
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before accessing this resource"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("[AUTH] Authentication error:", error);
    return res.status(500).json({
      error: "Authentication failed",
      code: ERROR_CODES.INTERNAL_ERROR,
    });
  }
};

// Alias for routes.js compatibility
export const requireAuth = authenticate;

// ============ ROLE MIDDLEWARE ============

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: ERROR_CODES.UNAUTHORIZED,
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        code: ERROR_CODES.FORBIDDEN,
      });
    }

    next();
  };
};

export const requireAdmin = requireRole(ROLES.ADMIN);
export const requireTrainer = requireRole(ROLES.TRAINER, ROLES.ADMIN);
export const requireUser = requireRole(ROLES.USER, ROLES.TRAINER, ROLES.ADMIN);

// ============ SELF OR ROLE MIDDLEWARE ============

export const requireSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }

  const targetUserId = req.params.userId;

  if (req.user.id === targetUserId || req.user.role === ROLES.ADMIN) {
    return next();
  }

  return res.status(403).json({
    error: "Access denied",
    code: ERROR_CODES.FORBIDDEN,
  });
};

export const requireSelfOrTrainer = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }

  const targetUserId = req.params.userId;

  if (
    req.user.id === targetUserId ||
    req.user.role === ROLES.TRAINER ||
    req.user.role === ROLES.ADMIN
  ) {
    return next();
  }

  return res.status(403).json({
    error: "Access denied",
    code: ERROR_CODES.FORBIDDEN,
  });
};

// ============ PROFILE COMPLETE MIDDLEWARE ============

export const requireProfileComplete = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }

  if (!req.user.profileComplete) {
    return res.status(403).json({
      error: "Profile must be completed first",
      code: ERROR_CODES.FORBIDDEN,
    });
  }

  next();
};

// ============ VALIDATION MIDDLEWARE ============

export const validateBody = (schema) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      if (rules.required && (value === undefined || value === null || value === "")) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value !== undefined && value !== null && value !== "") {
        if (rules.type === "string" && typeof value !== "string") {
          errors.push(`${field} must be a string`);
        }

        if (rules.type === "number" && typeof value !== "number") {
          errors.push(`${field} must be a number`);
        }

        if (rules.type === "boolean" && typeof value !== "boolean") {
          errors.push(`${field} must be a boolean`);
        }

        if (rules.type === "array" && !Array.isArray(value)) {
          errors.push(`${field} must be an array`);
        }

        if (rules.min !== undefined && typeof value === "number" && value < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }

        if (rules.max !== undefined && typeof value === "number" && value > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`);
        }

        if (rules.minLength !== undefined && typeof value === "string" && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        }

        if (rules.maxLength !== undefined && typeof value === "string" && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters`);
        }

        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rules.enum.join(", ")}`);
        }

        if (rules.validate && !rules.validate(value)) {
          errors.push(rules.message || `${field} is invalid`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        code: ERROR_CODES.VALIDATION_ERROR,
        details: errors,
      });
    }

    next();
  };
};

// ============ ERROR HANDLERS ============

export const errorHandler = (err, req, res, next) => {
  console.error("[ERROR]", err);

  if (err.code === "P2002") {
    return res.status(409).json({
      error: "A record with this value already exists",
      code: ERROR_CODES.DUPLICATE_ENTRY,
      field: err.meta?.target?.[0],
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      error: "Record not found",
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: err.message,
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  }

  return res.status(500).json({
    error: "Internal server error",
    code: ERROR_CODES.INTERNAL_ERROR,
  });
};

export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    error: "Route not found",
    code: ERROR_CODES.NOT_FOUND,
  });
};

// ============ ASYNC WRAPPER ============

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};