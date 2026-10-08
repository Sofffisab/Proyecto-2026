// src/api/services/gamification.api.js
//
// Maps 1:1 to Backend/src/routes/index.js "GAMIFICATION ROUTES" section and
// Backend/src/controllers/gamification.controller.js.
// There's no manual claim, catalog, or leaderboard endpoint by design —
// points/badges are unlocked purely from activity server-side (see
// Backend/src/services/gamification.service.js).

import { apiClient } from '../client';

// GET /gamification/points
// -> { totalPoints, transactions } (see gamification.service.js#getPoints).
// totalPoints already reflects the "reset to 0 on reward redemption" rule
// from the spec (Backend/src/services/reward.service.js#autoGrantRewards
// logs a negative transaction), so the client never needs to compute wrap-around.
export function getPoints() {
  return apiClient.get('/gamification/points');
}

// GET /gamification/badges — unlocked achievements (Pantalla logros y metas,
// spec section 6), kept here since it's the same resource family.
export function getBadges() {
  return apiClient.get('/gamification/badges');
}

// POST /gamification/review-request — body validated against
// Backend/src/validators/progress.schemas.js#pointReviewRequestSchema.
// Used from the points-related "denuncia" flow (spec: pop-up de Denuncias
// can target "puntos, logros, etc."), kept here for the same reason as above.
export function createReviewRequest(reason) {
  return apiClient.post('/gamification/review-request', { reason });
}

// GET /admin/review-requests — ADMIN only, unresolved PointReviewRequest
// rows with the requesting user attached (gamification.controller.js
// #getReviewRequests). Powers the "Peticiones de revisión" section of the
// Admin Review Reports screen (spec section 18) — these come from the
// pop-up de Denuncias' "app element" (points/achievements) target, which
// createReviewRequest() above files instead of a Complaint.
export function getReviewRequests() {
  return apiClient.get('/admin/review-requests');
}

// PATCH /admin/review-requests/:id/resolve — ADMIN only. Marks a
// PointReviewRequest as resolved (gamification.controller.js
// #resolveReviewRequest); the Backend doesn't currently branch on an
// approved/rejected outcome, it only flips resolved: true.
export function resolveReviewRequest(id) {
  return apiClient.patch(`/admin/review-requests/${id}/resolve`, {});
}

// GET /analytics/wrapped?year=YYYY — Spotify-style yearly stats (spec
// section 8). Backend/src/services/wrapped.service.js#generateWrapped
// computes it on the fly (sessions, minutes, points, top machines,
// assistances, people met, top trainers) and upserts a snapshot, so this
// always reflects current data for that year. Defaults to the current
// year server-side if `year` is omitted.
export function getWrapped(year) {
  return apiClient.get(year ? `/analytics/wrapped?year=${encodeURIComponent(year)}` : '/analytics/wrapped');
}
