import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import router from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";
import { logger } from "./utils/logger.js";
const app = express();
 
app.use(helmet({
  contentSecurityPolicy: false, // mobile clients don't use CSP
}));
 
// CORS only checks the Origin header, which mobile/non-browser clients
// don't send. Real access control lives in the auth/role middlewares.
if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  logger.warn(
    "[server] ALLOWED_ORIGINS is not set in production — no browser origin will be trusted (mobile clients are unaffected)."
  );
}
 
app.use(cors({
  origin(origin, callback) {
    // In local development, don't gate on ALLOWED_ORIGINS at all — Expo web
    // on whatever port Metro picks, Postman, curl, etc. always get a green
    // light. Test and production still enforce the allowlist below.
    if (process.env.NODE_ENV === "development") {
      return callback(null, true);
    }
 
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : [];
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count"],
  credentials: true,
  maxAge: 86400,
}));
 
app.use(express.json({ limit: "2mb" }));          // enough for base64 profile photos
app.use(express.urlencoded({ extended: true }));
 
app.use(compression());
 
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}
 
// Mounted both at the versioned prefix (used by Frontend/vercel.json crons)
// and at root (used by the test suite), so both path styles work.
app.use("/api/v1", router);
app.use(router);
 
app.use(notFoundHandler);
app.use(errorHandler);
 
export default app;