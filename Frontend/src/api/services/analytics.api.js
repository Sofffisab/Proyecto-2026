// src/api/services/analytics.api.js
//
// Maps to Backend/src/routes/index.js "ANALYTICS ROUTES" and
// Backend/src/controllers/analytics.controller.js. Only the admin-facing
// gym-wide endpoint is wired here; per-user analytics (/analytics/me,
// /analytics/wrapped, /analytics/patterns) belong to the member-facing
// screens instead.

import { apiClient } from '../client';

// GET /analytics/gym — ADMIN only. Powers the Statistics screen (spec
// section 16): machine usage percentages ("Generales del gym"), trainer
// count/average rating ("Entrenadores"), and active/inactive users plus
// goal completion counts ("Usuarios"). See
// Backend/src/services/insights.service.js#getGymAnalytics.
export function getGymAnalytics() {
  return apiClient.get('/analytics/gym');
}
