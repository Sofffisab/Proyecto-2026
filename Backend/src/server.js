import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import router from "./routes/index.js";
import { runJobs } from "./jobs/index.js";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";
const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // mobile clients don't use CSP
}));

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

// Root-level alias — some cron providers hit a bare path without the API prefix.
// Vercel Cron Jobs invoke the configured path with GET; POST is also kept
// so the job can still be triggered manually (e.g. for testing).
const cronAuth = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};
app.get("/cron/jobs", cronAuth, runJobs);
app.post("/cron/jobs", express.json({ limit: "2mb" }), cronAuth, runJobs);

app.use("/api/v1", router);
app.use("/", router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;