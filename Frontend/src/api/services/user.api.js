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

// GET /trainers — active trainers, open to any authenticated role (not
// gated by authorize() server-side). Used by the User/Trainer Reports
// screens to populate the "list of trainers" report-target option.
export function getTrainers() {
  return apiClient.get('/trainers');
}

// GET /users — TRAINER/ADMIN only (user.service.js#getAll). Paginated list
// of every account (id, email, name, role, isActive, createdAt,
// trainerProfile), used to resolve names for member-facing lists where the
// underlying resource only stores a bare user id (e.g. joining
// Complaint.reportedUserId on the Admin Review Reports screen, spec
// section 18).
export function getUsers({ limit = 100, offset = 0 } = {}) {
  return apiClient.get(`/users?limit=${limit}&offset=${offset}`);
}

// PATCH /users/:id/status — ADMIN only
// (Backend/src/validators/user.schemas.js#deactivateUserSchema). Powers the
// Admin Members screen's "Desactivar/Activar cuenta" (spec section 15): the
// account isn't deleted, the person just loses access to the app.
export function setUserActive(userId, isActive) {
  return apiClient.patch(`/users/${userId}/status`, { isActive });
}

