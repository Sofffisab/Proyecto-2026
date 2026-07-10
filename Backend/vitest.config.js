import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",

    // A few security/e2e tests fire 100+ real sequential HTTP requests
    // through supertest (rate-limit tests, mainly). That's already close to
    // the old 5000ms default without coverage, and goes over it once v8
    // coverage instrumentation is enabled. 10s of headroom avoids false
    // failures without hiding a genuinely hung test.
    testTimeout: 10000,

    setupFiles: ["tests/setup.js"],

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      // If overall coverage falls below these numbers, `npm run test:coverage`
      // exits with a non-zero code (fails), even though every individual test
      // still passes. This is what actually protects you against the "tests
      // are green but code is still broken/uncovered" scenario: someone adds
      // new code with no tests, and the coverage command itself complains.
      thresholds: {
        lines: 65,
        statements: 65,
        functions: 65,
        branches: 55,
      },
    },
  },
});