import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const compression = require("compression");

import routes from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(helmet());

app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  return res.status(200).json({ success: true, message: "Server is running" });
});

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;