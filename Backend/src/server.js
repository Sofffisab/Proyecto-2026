import express from "express";
import cors from "cors";
import helmet from "helmet";

import routes from "./routes/index.js";

import {
  apiRateLimiter,
} from "./middlewares/rateLimiter.js";

import {
  notFoundHandler,
  errorHandler,
} from "./middlewares/error.middleware.js";

const app = express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

app.use(helmet());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(apiRateLimiter);

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

app.use("/api", routes);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;