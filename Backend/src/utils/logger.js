// Minimal structured logger: adds level + timestamp to each console line.

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
