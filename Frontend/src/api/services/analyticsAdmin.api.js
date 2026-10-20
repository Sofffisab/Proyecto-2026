// src/api/services/analyticsAdmin.api.js
//
// Admin-only analytics endpoints - maps to Backend/src/routes/index.js
// "ANALYTICS ROUTES" and Backend/src/controllers/analytics.controller.js.
// Powers the Admin Full History screen (spec section 19): a cross-user
// export of every session and machine usage, run through the
// pseudonymization/consent layer in Backend/src/utils/privacy.js so it
// never leaks a withdrawn-consent user's identity even to an Admin.

import { apiClient } from '../client';

// GET /analytics/admin/history?identified=true|false
// (insights.service.js#getFullHistoryAdmin). Each row is always
// pseudonymized (stable pseudoId + consented flag); with
// includeIdentifiers=true, real name/email are additionally attached, but
// ONLY for users who did not withdraw analyticsConsent — the "Filtros de
// privacidad" toggle on this screen simply flips that query flag.
export function getFullHistoryAdmin({ includeIdentifiers = false } = {}) {
  return apiClient.get(`/analytics/admin/history?identified=${includeIdentifiers ? 'true' : 'false'}`);
}
