// src/api/services/history.api.js
//
// Maps to Backend/src/controllers/history.controller.js /
// Backend/src/services/history.service.js.
//
// IMPORTANT: these two endpoints existed in the Backend as controller +
// service but had never been wired into routes/index.js — confirmed by
// reading routes/index.js directly. Added the missing `router.get(...)`
// lines only (no controller/service logic touched):
//   GET /history/interactions
//   GET /history/machine-usage
//   GET /history/trainer-assistance (trainer-facing, see trainer History module)
//
// Also worth flagging (not fixed, since it's service-layer logic, not a
// missing route): Backend/src/services/history.service.js#getInteractionHistory
// reads `assistance.machine` and `assistance.trainerRating` off Assistance
// rows, but Backend/prisma/schema.prisma's Assistance model has neither a
// machine relation nor a trainerRating field, and the Prisma query for it
// doesn't `include` a machine either. In practice this means every trainer
// interaction in this history will come back with `machineName: null` and
// `rating: null/undefined` regardless of what actually happened — that's a
// pre-existing backend data gap, not something the frontend can compute.

import { apiClient } from '../client';

// GET /history/interactions — trainers who assisted the user + completed
// social challenge partners, each with a name and date. Powers "social
// interactions" and "trainer interactions" in the spec's History screen.
export function getInteractionHistory() {
  return apiClient.get('/history/interactions');
}

// GET /history/machine-usage — machines used, grouped by day, with
// start/end time and duration per machine. Powers "qué máquinas usaron y
// qué día" in the spec's History screen.
export function getDailyMachineUsageLog() {
  return apiClient.get('/history/machine-usage');
}

// GET /history/trainer-assistance — TRAINER/ADMIN only. The trainer's own
// detailed assistance history (student, machine, date, rating). Exported
// here (same resource family) for the Trainer History module (spec
// section 11), not used by the member-facing screen in this file.
export function getTrainerAssistanceHistory() {
  return apiClient.get('/history/trainer-assistance');
}
