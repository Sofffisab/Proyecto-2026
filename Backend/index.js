import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import router from "./routes.js";
import { errorHandler, notFoundHandler } from "./shared/middlewares.js";
import { setupSocketHandlers } from "./shared/socket.js";
import { setupQRCron, setupStatsCron, setupCleanupCron, setupRemindersCron } from "./shared/cron.js";
import { initializeFirebase } from "./features/notifications.js";
import { prisma } from "./prisma/prisma.js";

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8081";
const CRON_ENABLED = process.env.CRON_ENABLED === "true";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

app.set("io", io);
setupSocketHandlers(io);

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later" },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(generalLimiter);

// Apply auth limiter to auth routes
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);

app.use("/api/v1", router);

// Health check with database verification
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error("[HEALTH] Database check failed:", error);
    res.status(503).json({
      status: "degraded",
      database: "disconnected",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

// ============ GRACEFUL SHUTDOWN ============

const gracefulShutdown = async (signal) => {
  console.log(`\n[INFO] Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close HTTP server
    httpServer.close(() => {
      console.log("[INFO] HTTP server closed");
    });

    // Close Socket.io connections
    io.close(() => {
      console.log("[INFO] Socket.io connections closed");
    });

    // Disconnect from database
    await prisma.$disconnect();
    console.log("[INFO] Database connection closed");

    process.exit(0);
  } catch (error) {
    console.error("[ERROR] Error during graceful shutdown:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Rejection at:", promise, "reason:", reason);
});

const startServer = async () => {
  try {
    await initializeFirebase();
    console.log("[INFO] Services initialized");

    if (CRON_ENABLED) {
      setupQRCron();
      setupStatsCron();
      setupCleanupCron();
      setupRemindersCron();
      console.log("[INFO] Cron jobs enabled");
    } else {
      console.log("[INFO] Cron jobs disabled");
    }

    httpServer.listen(PORT, () => {
      console.log(`[INFO] Server running on port ${PORT}`);
      console.log(`[INFO] Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`[INFO] Frontend URL: ${FRONTEND_URL}`);
    });
  } catch (error) {
    console.error("[ERROR] Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

export { app, httpServer, io };