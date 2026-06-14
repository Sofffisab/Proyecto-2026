export default {
  testEnvironment: "node",

  roots: ["<rootDir>/tests"],

  moduleFileExtensions: [
    "js",
    "json"
  ],

  transform: {},

  collectCoverageFrom: [
    "src/**/*.js",
    "!src/index.js"
  ],

  coverageDirectory: "coverage",

  verbose: true,
};