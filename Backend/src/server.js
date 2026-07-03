import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import router from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";
const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // mobile clients don't use CSP
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

app.use(cors({
  origin(origin, callback) {
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

app.use("/api/v1", router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;