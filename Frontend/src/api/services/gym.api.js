// src/api/services/gym.api.js
//
// Maps to Backend/src/routes/index.js "GYM ACCESS ROUTES" and
// Backend/src/controllers/gym.controller.js. Only the read used by the
// History screen (spec section 4, "cuándo llegaron y cuándo se fueron")
// is wired here for now; check-in/check-out themselves happen through
// the QR scan flow (see qr.api.js), not a direct button.

import { apiClient } from '../client';

// GET /gym/sessions — this user's gym sessions (check-in/check-out
// timestamps, duration, whether it was auto-closed), most recent first.
// Note: Backend/src/services/gym.service.js#getSessionHistory returns
// bare GymSession rows (no included machineUsages/ratings/complaints) —
// those are fetched separately via history.api.js / reward.api.js /
// complaint.api.js and merged client-side in the History screen.
export function getSessionHistory() {
  return apiClient.get('/gym/sessions');
}

// GET /gym/occupancy/live — users currently checked in (active session,
// no checkOutAt yet). Used by the User Reports screen (spec section 3's
// "pop up Denuncias") to list "personas que figuran en el gym" as
// report-target candidates.
export function getPresentUsers() {
  return apiClient.get('/gym/occupancy/live');
}

// POST /gym/sessions/:id/rate — body validated against
// Backend/src/validators/progress.schemas.js#rateTrainerSchema:
// { trainerId, rating (1-5), helped (default true), comment? }.
// Powers the Rate Trainer(s) pop-up (spec section 3): when helped=false,
// the Backend automatically files a complaint against the trainer
// alongside the rating (see gym.service.js#rateTrainer), so the popup
// does not need a separate complaint call for "no me ayudaron".
export function rateTrainer(sessionId, { trainerId, rating, helped = true, comment }) {
  return apiClient.post(`/gym/sessions/${sessionId}/rate`, { trainerId, rating, helped, comment });
}
