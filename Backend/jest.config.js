export default {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleFileExtensions: ["js", "json"],
  transform: {},
  extensionsToTreatAsEsm: [".js"],
  experimental: {
    vmModules: true,
  },
  collectCoverageFrom: ["src/**/*.js", "!src/index.js"],
  coverageDirectory: "coverage",
  verbose: true,
};