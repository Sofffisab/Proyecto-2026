import "dotenv/config";

import app from "./server.js";
import { logger } from "./utils/logger.js";

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "FRONTEND_URL",
  "ABLY_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "CRON_SECRET", 
];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  logger.error(
    `[startup] Missing required environment variables:\n  ${missing.join("\n  ")}`
  );
  logger.error("[startup] Server will not start. Add them to your .env file.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`
=================================
GYM BACKEND RUNNING
PORT: ${PORT}
ENV: ${process.env.NODE_ENV}
=================================
`);
});