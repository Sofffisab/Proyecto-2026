// src/api/services/auth.api.js
//
// Maps 1:1 to Backend/src/routes/index.js "PUBLIC / AUTH ROUTES" section
// and Backend/src/controllers/auth.controller.js.
// There is intentionally no register() here — accounts are created only
// by an Admin (see admin/MembersScreen's "Crear sesión nueva", module 15,
// which calls POST /auth/users). Self-registration was removed from the
// Backend entirely per that business rule; see routes/index.js's comment
// at the top of the "PUBLIC / AUTH ROUTES" section.
// None of these calls attach the Authorization header (auth: false) except
// logout, which needs the current access token so the Backend can
// blacklist it (see Backend/src/services/auth.service.js#logout).

import { apiClient } from '../client';

// POST /auth/login
export function login({ email, password }) {
  return apiClient.post('/auth/login', { email, password }, { auth: false });
}

// POST /auth/logout — blacklists the current access token server-side.
export function logout() {
  return apiClient.post('/auth/logout', undefined, { auth: true });
}

// POST /auth/forgot-password
export function forgotPassword(email) {
  return apiClient.post('/auth/forgot-password', { email }, { auth: false });
}

// POST /auth/reset-password
export function resetPassword({ token, newPassword }) {
  return apiClient.post('/auth/reset-password', { token, newPassword }, { auth: false });
}

// GET /users/me — canonical "who am I" endpoint (also aliased at
// GET /user/profile server-side, see routes/index.js).
export function getMe() {
  return apiClient.get('/users/me');
}

// POST /auth/users — ADMIN only. Creates the account record and sends the
// "Mail de Sesión Nueva" (spec section 15, "Crear sesión nueva") so the
// person can accept it and set their own password. Body validated against
// Backend/src/validators/auth.schemas.js#createUserByAdminSchema.
export function createUserByAdmin({ email, firstName, lastName, role }) {
  return apiClient.post('/auth/users', { email, firstName, lastName, role });
}
