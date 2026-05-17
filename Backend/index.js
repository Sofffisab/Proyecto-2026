import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import router from "./routes.js";
import setupMiddlewares, { errorHandler, notFoundHandler } from "./shared/middlewares.js";
import { setupSocketHandlers } from "./shared/socket.js";
import { setupQRCron, setupStatsCron, setupCleanupCron, setupRemindersCron } from "./shared/cron.js";
import { initializeFirebase } from "./features/notifications.js";

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

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later" },
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

app.use("/api/v1", router);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

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