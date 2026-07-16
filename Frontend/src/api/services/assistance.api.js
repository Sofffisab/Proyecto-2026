// src/api/services/assistance.api.js
//
// Maps 1:1 to Backend/src/routes/index.js "ASSISTANCE ROUTES" section and
// Backend/src/controllers/assistance.controller.js.
// Only the member-facing actions live here; assign/complete/availability
// are trainer-facing and belong to the Trainer Help module instead.

import { apiClient } from '../client';

// POST /assistance/request — spec section 3, "Pedir Ayuda" button.
// Backend/src/services/assistance.service.js#requestAssistance creates a
// PENDING Assistance row, prioritizes an available trainer (specialized in
// the machine when possible), and pushes a notification to them; it always
// goes through even if the user disabled proactive assistance in Settings
// (disableAssistance only blocks unprompted outreach, not an explicit ask).
export function requestAssistance() {
  return apiClient.post('/assistance/request');
}

// GET /assistance/active — pending assistance requests. Not used by the
// member Home screen itself, exported for completeness/reuse (e.g. to
// show "help is on the way" state) since it maps to the same resource.
export function getActiveAssistance() {
  return apiClient.get('/assistance/active');
}

// PATCH /assistance/:id/cancel — lets the requester cancel their own
// pending/assigned request.
export function cancelAssistance(assistanceId) {
  return apiClient.patch(`/assistance/${assistanceId}/cancel`);
}

// PATCH /assistance/trainer/availability — TRAINER/ADMIN only. Lets the
// authenticated trainer toggle whether they're available to be prioritized
// for new "Pedir Ayuda" requests. Powers an availability switch on the
// Trainer Home screen (spec section 9).
export function setTrainerAvailability(availability) {
  return apiClient.patch('/assistance/trainer/availability', { availability });
}
