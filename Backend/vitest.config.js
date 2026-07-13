import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",

    // Some e2e/security tests fire 100+ sequential HTTP requests (rate-limit
    // tests); this is close to the 5s default even without coverage, so
    // give it headroom without hiding a genuinely hung test.
    testTimeout: 10000,

    setupFiles: ["tests/setup.js"],

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      // If coverage falls below these numbers, test:coverage fails even
      // though every test passes — guards against untested new code.
      thresholds: {
        lines: 65,
        statements: 65,
        functions: 65,
        branches: 55,
      },
    },
  },
});