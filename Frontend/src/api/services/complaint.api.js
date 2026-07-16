// src/api/services/complaint.api.js
//
// Maps to Backend/src/routes/index.js "COMPLAINTS ROUTES" and
// Backend/src/controllers/complaint.controller.js. This is the spec's
// "Denuncias" concept — in this codebase it was already implemented as a
// dedicated Reports screen/flow (spec section 3's "pop up Denuncias" maps
// 1:1 to the existing USER_REPORTS route) rather than a pop-up, so the
// create-complaint call belongs to the User/Trainer Reports module.
// Only the read used by the History screen (spec section 4, "si hicieron
// alguna denuncia") is wired here for now.

import { apiClient } from '../client';

// GET /complaints/me — complaints filed by the authenticated user (as
// reporter), most recent first.
export function getMyComplaints() {
  return apiClient.get('/complaints/me');
}

// POST /complaints — body validated against
// Backend/src/validators/progress.schemas.js#createComplaintSchema.
// Exported here for the Reports module to reuse; not called from History.
export function createComplaint({ reportedUserId, reason, message }) {
  return apiClient.post('/complaints', { reportedUserId, reason, message });
}

// POST /complaints/trainer — TRAINER/ADMIN only. Body validated against
// Backend/src/validators/progress.schemas.js#createTrainerComplaintSchema:
// { reportedUserId, reason: one of MACHINE_DAMAGE|MISCONDUCT|RULE_VIOLATION|OTHER,
// message? }. Lets a trainer report a member directly (spec section 11),
// distinct from the free-text `reason` used by the member-facing
// createComplaint above.
export function createTrainerComplaint({ reportedUserId, reason, message }) {
  return apiClient.post('/complaints/trainer', { reportedUserId, reason, message });
}
