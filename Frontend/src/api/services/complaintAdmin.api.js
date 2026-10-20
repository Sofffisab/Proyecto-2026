// src/api/services/complaintAdmin.api.js
//
// Admin-only complaint moderation endpoints - maps to
// Backend/src/routes/index.js "COMPLAINTS ROUTES" and
// Backend/src/controllers/complaint.controller.js. Complements
// complaint.api.js (member/trainer-facing create + "my complaints") with
// the Admin Review Reports screen (spec section 18): the full list of
// complaints ("Denuncias hechas y aprobadas") plus the approve/reject
// actions that drive the progressive-penalty logic in
// Backend/src/services/complaint.service.js#approveComplaint.

import { apiClient } from '../client';

// GET /complaints — every complaint in the system, admin only
// (complaint.service.js#getComplaints). No user names embedded on the
// Complaint model itself, so the screen joins against GET /users.
export function getAllComplaints() {
  return apiClient.get('/complaints');
}

// GET /complaints/:id — detail of a single complaint, for the admin to open
// when tapping a row on ReviewReportsScreen (complaint.service.js#getComplaintById,
// exposed via complaint.controller.js#getComplaintDetail).
export function getComplaintDetail(id) {
  return apiClient.get(`/complaints/${id}`);
}

// PATCH /complaints/:id/resolve — marks PENDING -> APPROVED. Triggers the
// progressive point penalty (free strikes, then -25/-50/... capped at
// -150) and, past ALERT_THRESHOLD (5) approved complaints against the
// same user, auto-raises a PointReviewRequest for admin follow-up.
export function approveComplaint(id) {
  return apiClient.patch(`/complaints/${id}/resolve`, {});
}

// PATCH /complaints/:id/reject — marks PENDING -> REJECTED, no penalty.
export function rejectComplaint(id) {
  return apiClient.patch(`/complaints/${id}/reject`, {});
}
