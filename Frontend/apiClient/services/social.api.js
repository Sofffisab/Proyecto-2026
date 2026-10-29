// src/api/services/social.api.js
//
// Maps to Backend/src/routes/index.js "SOCIAL INTERACTIONS" routes and
// Backend/src/services/social.service.js.
//
// The app makes very few requests on purpose: everything that *happens*
// (an invitation arriving, the other person accepting, the QR phase opening,
// the challenge completing or being cancelled) is pushed through Ably — see
// context/SocialContext.js. These are the only calls:
//   getSocialState  once on start-up / reconnect
//   getAblyToken    once an hour per connection (Ably asks for renewals)
//   tick            ONE client per gym, once per round (leader election)
//   respond/cancel  when the person presses a button

import { apiClient } from '../../apiClient/client';

// GET /social/state — { inGym, disabled, roundIntervalMs, challenge|null }
export function getSocialState() {
  return apiClient.get('/social/state');
}

// GET /social/ably-token — Ably TokenRequest (clientId = the user's id)
export function getAblyToken() {
  return apiClient.get('/social/ably-token');
}

// POST /social/tick — runs a matching round on the server. Cheap no-op when
// a round already ran in this interval.
export function tick() {
  return apiClient.post('/social/tick', {});
}

// POST /social/:id/respond — Yes (accept: true) / No (accept: false) on the
// "¿Querés hacer un amigo?" pop-up.
export function respond(challengeId, accept) {
  return apiClient.post(`/social/${challengeId}/respond`, { accept });
}

// POST /social/:id/cancel — "cerrar" on any pop-up (or leaving the gym).
export function cancel(challengeId) {
  return apiClient.post(`/social/${challengeId}/cancel`, {});
}
