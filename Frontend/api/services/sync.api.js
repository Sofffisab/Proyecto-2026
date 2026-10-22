// src/api/services/sync.api.js
//
// Maps to POST /sync (Backend/src/routes/index.js) and
// Backend/src/controllers/sync.controller.js#syncOfflineActions, validated
// against Backend/src/validators/progress.schemas.js#syncActionsSchema:
// { actions: [{ type: 'checkin'|'checkout'|'machineStart'|'machineEnd',
// timestamp, payload? }] }, max 100 per batch. Processes them in order,
// per-item success/failure (a bad item doesn't abort the rest of the batch).
//
// See offline/offlineQueue.js for the local queue that calls this.

import { apiClient } from '../client';

export function syncOfflineActions(actions) {
  return apiClient.post('/sync', { actions });
}
