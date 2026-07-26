// src/api/services/analytics.api.js
//
// Maps to Backend/src/routes/index.js "ANALYTICS ROUTES" and
// Backend/src/controllers/analytics.controller.js.

import { apiClient } from '../client';

// GET /analytics/gym — ADMIN only. Powers the Statistics screen (spec
// section 16): machine usage percentages ("Generales del gym"), trainer
// count/average rating ("Entrenadores"), and active/inactive users plus
// goal completion counts ("Usuarios"). See
// Backend/src/services/insights.service.js#getGymAnalytics.
export function getGymAnalytics() {
  return apiClient.get('/analytics/gym');
}

// GET /analytics/me — this user's own stats: total/daily/weekly/monthly
// sessions & minutes, machine usage breakdown, and goal adherence (declared
// weekly training days vs actual check-ins this week). See
// Backend/src/services/insights.service.js#getUserAnalytics. Powers the
// User Analytics screen.
export function getUserAnalytics() {
  return apiClient.get('/analytics/me');
}

// GET /analytics/patterns — this user's learned behavior profile: frequent
// training days/hour, top machines, detected recurring routines, and a
// consistency score. See
// Backend/src/services/behaviorAnalysis.service.js#getUserBehaviorProfile.
// Powers the User Analytics screen.
export function getUserPatterns() {
  return apiClient.get('/analytics/patterns');
}

// GET /analytics/engagement — ADMIN only. Gym-wide totals: total/active
// users, total sessions, total points awarded. See
// Backend/src/services/engagement.service.js#getEngagementMetrics. Powers
// the Admin Statistics screen's engagement card.
export function getEngagementMetrics() {
  return apiClient.get('/analytics/engagement');
}
