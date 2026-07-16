// src/api/services/challenge.api.js
//
// Maps to Backend/src/routes/index.js "CHALLENGES ROUTES" and
// Backend/src/controllers/challenge.controller.js /
// Backend/src/services/challenge.service.js.
//
// Social challenges are auto-assigned server-side (jobs/challenge.job.js
// picks 2 present users at random) — this file only covers the client
// actions around an already-assigned challenge: reading the active one(s)
// and accepting/rejecting from the Social Interaction pop-up (spec
// section 3). The actual QR pairing step re-uses qr.api.js#scanQR /
// qr.api.js#getMyQR — the Backend auto-completes the challenge from a
// "USER" type QR scan (see verification.service.js#processScan), so no
// separate "complete" call is made from this popup.

import { apiClient } from '../client';

// GET /challenges/active — this user's currently ASSIGNED/ACCEPTED social
// challenge(s), if any. Used to know whether to show the pop-up at all,
// and which partner/id it refers to.
export function getActiveChallenges() {
  return apiClient.get('/challenges/active');
}

// PATCH /challenges/:id/join — only the challenged partner can accept.
// Moves an ASSIGNED challenge to ACCEPTED.
export function acceptChallenge(challengeId) {
  return apiClient.patch(`/challenges/${challengeId}/join`);
}

// PATCH /challenges/:id/cancel — either participant can reject/cancel.
export function cancelChallenge(challengeId) {
  return apiClient.patch(`/challenges/${challengeId}/cancel`);
}
