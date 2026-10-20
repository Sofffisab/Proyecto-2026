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

export function getGoalById(goalId) {
  return apiClient.get(`/goals/${goalId}`);
}

// PATCH /goals/:id — partial update (any subset of goalSchema's fields:
// objectiveAction, objectiveType, targetValue, currentValue, unit).
// difficulty is never sent — it's computed server-side.
export function updateGoal(goalId, changes) {
  return apiClient.patch(`/goals/${goalId}`, changes);
}

export function deleteGoal(goalId) {
  return apiClient.delete(`/goals/${goalId}`);
}

export function createGoal(payload) {
  return apiClient.post('/goals', payload);
}

// GET /progress/stats — aggregate stats across all of the user's progress
// entries (progress.service.js#getProgressStats).
export function getProgressStats() {
  return apiClient.get('/progress/stats');
}

export function getProgressEntryById(entryId) {
  return apiClient.get(`/progress/${entryId}`);
}

// PUT /progress/:id — was already mounted server-side; this is the "log
// progress toward a goal" action (value + optional note). The Backend
// separately nudges the user via a notification if a goal goes stale
// (see suggestionEngine.service.js, run periodically by jobs/progress.job.js)
// rather than the client needing to track staleness itself.
export function updateProgressEntry(entryId, { value, note }) {
  return apiClient.put(`/progress/${entryId}`, { value, note });
}

export function deleteProgressEntry(entryId) {
  return apiClient.delete(`/progress/${entryId}`);
}

export function addProgressLog({ goalId, value }) {
  return apiClient.post('/progress', { goalId, value });
}

// GET /progress/history — the user's logged progress entries, used if a
// more detailed per-entry breakdown is ever needed for a goal.
export function getProgressHistory() {
  return apiClient.get('/progress/history');
}
