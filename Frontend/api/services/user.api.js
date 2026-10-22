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
// screens to populate the "list of trainers" report-target option, and by
// the User Trainers screen (list before viewing a public profile).
export function getTrainers() {
  return apiClient.get('/trainers');
}

// GET /trainers/:id — public profile of a single trainer (specialties,
// average rating, availability), open to any authenticated role. Distinct
// from GET /users/:id (ADMIN/TRAINER only, full account data): this is
// what a member sees when picking a trainer. Powers the User Trainers
// screen's profile pop-up.
export function getTrainerById(trainerId) {
  return apiClient.get(`/trainers/${trainerId}`);
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

// GET /users/:id — ADMIN/TRAINER. Full profile for a single account (name,
// email, role, medical/associated data as permitted by
// user.service.js#getById's non-owner stripping). Powers the Admin Members
// screen's clickable-profile pop-up (spec section 15/12 pattern).
export function getUserById(userId) {
  return apiClient.get(`/users/${userId}`);
}

// PATCH /users/:id/role — ADMIN only
// (Backend/src/validators/user.schemas.js#updateRoleSchema). "Ascender o
// degradar" a alguien entre USER, TRAINER y ADMIN. Distinto del selector de
// rol que aparece al crear una cuenta nueva: este actúa sobre una cuenta ya
// existente.
export function changeUserRole(userId, role) {
  return apiClient.patch(`/users/${userId}/role`, { role });
}

// POST /users/:id/trainer-profile — ADMIN/TRAINER
// (Backend/src/validators/user.schemas.js#trainerProfileSchema). Crea o
// actualiza el perfil de entrenador (especialidad, etc.) de un usuario.
// Se usa junto con changeUserRole cuando se asciende a alguien a TRAINER,
// ya que sin este perfil el rol queda "vacío" (sin especialidad).
export function upsertTrainerProfile(userId, { specialty } = {}) {
  return apiClient.post(`/users/${userId}/trainer-profile`, { specialty });
}

