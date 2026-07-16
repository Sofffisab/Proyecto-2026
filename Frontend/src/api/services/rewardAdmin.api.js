// src/api/services/rewardAdmin.api.js
//
// Admin-only reward endpoints - maps to Backend/src/routes/index.js
// "REWARDS ROUTES" and Backend/src/controllers/reward.controller.js.
// Complements reward.api.js (member-facing) with the Admin Rewards screen
// (spec section 17): stock status, shipments in progress, and the
// out-of-stock waitlist.

import { apiClient } from '../client';

// GET /rewards/admin — full catalog including stock and
// isMarketingItem, admin only (reward.service.js#getAllRewardsAdmin).
export function getAllRewardsAdmin() {
  return apiClient.get('/rewards/admin');
}

// GET /rewards/redemptions — every automatic reward grant, with reward and
// user info. Filtered client-side into "in progress" (SHIPPED) vs already
// delivered, since the Backend keeps a single list forever.
export function getAllRedemptions() {
  return apiClient.get('/rewards/redemptions');
}

// GET /rewards/pending — users waiting for shipment because no
// active/in-stock reward was affordable at the time (reward.service.js
// #getPendingGrants), oldest first.
export function getPendingGrants() {
  return apiClient.get('/rewards/pending');
}

// PATCH /rewards/redemptions/:id — the only admin-driven status
// transition left once auto-shipping runs: mark a SHIPPED redemption as
// physically DELIVERED (reward.service.js#deliverReward).
export function markRedemptionDelivered(redemptionId) {
  return apiClient.patch(`/rewards/redemptions/${redemptionId}`, { status: 'DELIVERED' });
}
