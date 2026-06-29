// Re-export challenge-related schemas from the central progress.schemas.js
// so routes/index.js can import them from this dedicated file.
export {
  createChallengeSchema,
  completeChallengeSchema,
  cancelChallengeSchema,
} from "./progress.schemas.js";
