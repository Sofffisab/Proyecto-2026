import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import router from "./routes/index.js";

const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // mobile clients don't use CSP
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Total-Count"],    // useful for pagination on mobile
  credentials: true,
  maxAge: 86400,                        // cache preflight 24 h → fewer OPTIONS requests on mobile
}));

app.use(express.json({ limit: "2mb" }));          // enough for base64 profile photos
app.use(express.urlencoded({ extended: true }));

app.use(compression());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

app.use("/api/v1", router);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode ?? err.status ?? 500;
  const message    = err.message ?? "Internal server error";

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

export default app;