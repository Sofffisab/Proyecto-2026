// src/api/services/qr.api.js
//
// Maps 1:1 to Backend/src/routes/index.js "QR MANAGEMENT ROUTES" section and
// Backend/src/controllers/qr.controller.js.
//
// The member-facing surface is intentionally small: get your own QR, and
// scan/submit a payload. The Backend auto-detects what the payload means
// (see Backend/src/services/verification.service.js#processScan):
//   - type "ENTRY_EXIT" -> check-in or check-out (whichever applies)
//   - type "MACHINE"    -> starts/ends a machine usage
//   - type "USER"       -> completes a social/interaction challenge; only
//                          does something if there's an ACCEPTED
//                          SocialChallenge between scanner and target
//                          (matches spec 3: "solo si fue llamado a
//                          interacción pasa algo en ese caso").
// All entry/machine/exit disambiguation logic already lives server-side —
// the client only ever forwards the raw scanned payload string.

import { apiClient } from '../client';

// GET /qr/me — the authenticated user's own signed, timestamped QR payload
// (shown to a partner during a Social Interaction pop-up, spec section 3).
export function getMyQR() {
  return apiClient.get('/qr/me');
}

// POST /qr/scan — body validated against
// Backend/src/validators/progress.schemas.js#validateQRSchema: { payload }
// where payload is the raw scanned string (JSON-encoded QR content).
export function scanQR(payload) {
  return apiClient.post('/qr/scan', { payload });
}
