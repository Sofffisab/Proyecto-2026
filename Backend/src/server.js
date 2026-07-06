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

// NOTE: CORS only inspects the `Origin` header, which browsers attach but
// arbitrary HTTP clients (curl, native mobile HTTP stacks) do not have to
// send. Requests without an Origin header are always allowed below because
// that's the normal case for this app's mobile clients — CORS is therefore
// NOT a security boundary here. Actual access control must come from the
// auth/role middlewares (see auth.middleware.js / role.middleware.js), never
// from this origin check alone.
if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
  logger.warn(
    "[server] ALLOWED_ORIGINS is not set in production — all requests without an Origin header will still be allowed (expected for mobile clients), but no browser origin will be trusted either. Set ALLOWED_ORIGINS if any browser-based client needs access."
  );
}

app.use(cors({
  origin(origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [];
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
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

// Cron routes (including the CRON_SECRET auth check) live exclusively in
// routes/index.js to avoid duplicating that logic in two places.
//
// Mounted at both the versioned prefix (what the Frontend/vercel.json crons
// use) and at root (what the existing test suite — and Supertest calls in
// general — use). Without the root mount every route 404s for any client
// hitting an unprefixed path.
app.use("/api/v1", router);
app.use(router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;