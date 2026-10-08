// src/api/services/reward.api.js
//
// Maps to Backend/src/routes/index.js "REWARDS ROUTES" and
// Backend/src/controllers/reward.controller.js. Only the member-facing
// read used by the History screen (spec section 4, "si les dieron algún
// logro o premio") lives here for now; Admin catalog management belongs
// to the Admin Rewards module instead.

import { apiClient } from '../client';

// GET /rewards/redemptions/me — this user's reward redemptions (auto-granted
// on hitting a point threshold, see Backend/src/services/reward.service.js
// #autoGrantRewards), each with its reward and shipping status.
export function getMyRedemptions() {
  return apiClient.get('/rewards/redemptions/me');
}
