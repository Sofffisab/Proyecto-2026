// src/api/services/user.api.js
//
// Maps 1:1 to Backend/src/routes/index.js "USERS ROUTES" section and
// Backend/src/controllers/user.controller.js.
// All calls here operate on the *current* session user (never take an id),
// matching how the Backend scopes them to req.user.id.

import { apiClient } from '../client';

// GET /users/me (also aliased at GET /user/profile server-side).
export function getMe() {
  return apiClient.get('/users/me');
}

// PUT /users/me — body is validated against
// Backend/src/validators/user.schemas.js#updateProfileSchema. Used by both
// the Onboarding screen (objectives, trainingLevel, weeklyTrainingDays,
// trainingType) and the Settings screen (birthday, medicalConditions,
// deliveryAddress, etc). Only send fields that changed — every field is
// optional server-side.
export function updateProfile(patch) {
  return apiClient.put('/users/me', patch);
}

// PATCH /users/me/password
export function changePassword({ currentPassword, newPassword }) {
  return apiClient.patch('/users/me/password', { currentPassword, newPassword });
}

// PATCH /users/me/settings — validated against
// Backend/src/validators/user.schemas.js#updateSettingsSchema:
// { disableAssistance, disableSocial, trainerPreference, machineTrackingOptOut, analyticsConsent }
export function updateSettings(patch) {
  return apiClient.patch('/users/me/settings', patch);
}

// PATCH /users/me/fcm-token
export function updateFcmToken(fcmToken) {
  return apiClient.patch('/users/me/fcm-token', { fcmToken });
}

// DELETE /users/me — deactivates (not hard-deletes) the current account.
export function deactivateSelf() {
  return apiClient.delete('/users/me');
}
