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
