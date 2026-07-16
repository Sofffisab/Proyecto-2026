// src/api/services/progress.api.js
//
// Maps to Backend/src/controllers/progress.controller.js /
// Backend/src/services/progress.service.js, mounted at
// Backend/src/routes/index.js under "/goals" and "/progress"
// (see roughly lines 116-120).
//
// No routes/controller/service changes were needed for this module — every
// endpoint used here already existed and was already wired up.

import { apiClient } from '../client';

// GET /goals — the user's active goals (Goal model: type, targetValue,
// currentValue, difficulty). Powers the "goal progress" part of the
// Achievements & Goals screen (spec section 6).
export function getGoals() {
  return apiClient.get('/goals');
}

// POST /goals — create a new goal. Body validated against
// Backend/src/validators/progress.schemas.js#goalSchema.
export function createGoal(payload) {
  return apiClient.post('/goals', payload);
}

// GET /progress/history — the user's logged progress entries, used if a
// more detailed per-entry breakdown is ever needed for a goal.
export function getProgressHistory() {
  return apiClient.get('/progress/history');
}
