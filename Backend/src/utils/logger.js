// src/utils/logger.js
// Minimal structured logger. Keeps the same transport (stdout/stderr) as
// console.*, but gives every line a level and a timestamp so output can be
// filtered/aggregated by a log platform later without touching call sites.

function line(level, args) {
  const timestamp = new Date().toISOString();
  return [`[${timestamp}] [${level}]`, ...args];
}

export const logger = {
  info(...args) {
    // eslint-disable-next-line no-console
    console.log(...line("INFO", args));
  },
  warn(...args) {
    // eslint-disable-next-line no-console
    console.warn(...line("WARN", args));
  },
  error(...args) {
    // eslint-disable-next-line no-console
    console.error(...line("ERROR", args));
  },
};

export default logger;
