// src/api/services/routine.api.js
//
// Maps to Backend/src/controllers/routine.controller.js /
// Backend/src/services/routine.service.js, mounted at Backend/src/routes/index.js
// under "/routines" (see roughly lines 122-139).
//
// No routes/controller/service changes were needed for this module — every
// endpoint used here already existed and was already wired up.

import { apiClient } from '../client';

// GET /routines/today — home-screen options for "today": the user's saved
// routines, the always-available free routine, and a fresh AI-suggested
// routine if one is available. Powers the Routines screen's option list
// (pre-made / custom / recommended / none) plus the free-routine fallback.
export function getTodayOptions() {
  return apiClient.get('/routines/today');
}

// GET /routines — all of the user's saved routines (custom + previously
// accepted AI-suggested ones).
export function getRoutines() {
  return apiClient.get('/routines');
}

// GET /routines/:id — a single routine's full content (used for the
// step-by-step guide / read-on-your-own display modes).
export function getRoutineById(id) {
  return apiClient.get(`/routines/${id}`);
}

// POST /routines — create a custom routine. content is a free-form JSON
// object (Backend/src/validators/progress.schemas.js#createRoutineSchema
// only requires it to be an object); isCustom defaults to true server-side.
export function createRoutine({ name, content, isCustom } = {}) {
  return apiClient.post('/routines', { name, content, isCustom });
}

// PUT /routines/:id — edit a routine the user owns.
export function updateRoutine(id, { name, content } = {}) {
  return apiClient.put(`/routines/${id}`, { name, content });
}

// DELETE /routines/:id
export function deleteRoutine(id) {
  return apiClient.delete(`/routines/${id}`);
}

// PATCH /routines/:id/day/:dayIndex — mark a day of a routine as completed;
// awards POINTS.ROUTINE_DAY_COMPLETED server-side (routine.service.js).
export function completeDay(routineId, dayIndex) {
  return apiClient.patch(`/routines/${routineId}/day/${dayIndex}`);
}

// GET /routines/suggestions/patterns — "Recommended by the App" option:
// an AI-suggested routine built from the user's detected machine-usage
// patterns. Returns { available: false, reason } when there isn't enough
// history yet (see routine.service.js#getPatternSuggestion).
export function getPatternSuggestion() {
  return apiClient.get('/routines/suggestions/patterns');
}

// POST /routines/suggestions/accept — save the current AI suggestion as a
// real routine (isCustom: false, source: "AI_SUGGESTED"). Body may be
// omitted to let the server recompute the suggestion fresh.
export function acceptPatternSuggestion(override) {
  return apiClient.post('/routines/suggestions/accept', override);
}

// POST /routines/suggestions/reject — dismiss the current suggestion
// (nothing is deleted server-side, just avoids re-nagging + a notification).
export function rejectPatternSuggestion() {
  return apiClient.post('/routines/suggestions/reject');
}

// ---- Trainer-assigned routine requests ("recomendada por el App" flow
// where a trainer builds it) — included here since they live in the same
// Backend resource family and the User Routines screen is the natural
// place a user would trigger "request a routine from a trainer" from.

// POST /routines/requests — ask for a routine to be built, optionally for
// a specific trainer (Backend/src/validators/user.schemas.js#requestRoutineSchema).
export function requestRoutine(trainerId) {
  return apiClient.post('/routines/requests', trainerId ? { trainerId } : {});
}

// GET /routines/requests/all — the user's own requests and their status.
// For a TRAINER, the Backend scopes this to requests assigned to (or
// pending for) them, so the same function powers both the User Routines
// screen and the Trainer Routine Requests screen.
export function getMyRoutineRequests() {
  return apiClient.get('/routines/requests/all');
}

// PATCH /routines/requests/:id/accept — TRAINER accepts a client's routine
// request (routine.controller.js#acceptRequest).
export function acceptRoutineRequest(requestId) {
  return apiClient.patch(`/routines/requests/${requestId}/accept`);
}

// PATCH /routines/requests/:id/reject — TRAINER rejects a client's routine
// request (routine.controller.js#rejectRequest).
export function rejectRoutineRequest(requestId) {
  return apiClient.patch(`/routines/requests/${requestId}/reject`);
}

// PATCH /routines/requests/:id/complete — TRAINER marks an ACCEPTED routine
// request as delivered/completed (routine.controller.js#completeRequest).
// No body: the actual routine content is created separately by the trainer
// via createRoutine/updateRoutine; this only flips the request's status.
export function completeRoutineRequest(requestId) {
  return apiClient.patch(`/routines/requests/${requestId}/complete`);
}
