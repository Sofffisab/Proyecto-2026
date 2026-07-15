// src/api/services/auth.api.js
//
// Maps 1:1 to Backend/src/routes/index.js "PUBLIC / AUTH ROUTES" section
// and Backend/src/controllers/auth.controller.js.
// None of these calls attach the Authorization header (auth: false) except
// logout, which needs the current access token so the Backend can
// blacklist it (see Backend/src/services/auth.service.js#logout).

import { apiClient } from '../client';

// POST /auth/register — public registration always creates role USER
// (Backend/src/validators/auth.schemas.js#registerSchema).
export function register({ email, password, firstName, lastName }) {
  return apiClient.post(
    '/auth/register',
    { email, password, firstName, lastName },
    { auth: false }
  );
}

// POST /auth/login
export function login({ email, password }) {
  return apiClient.post('/auth/login', { email, password }, { auth: false });
}

// POST /auth/refresh-token — normally handled transparently by api/client.js
// on a 401, but exported too in case a screen needs to force it.
export function refreshToken(refreshTokenValue) {
  return apiClient.post(
    '/auth/refresh-token',
    { refreshToken: refreshTokenValue },
    { auth: false }
  );
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
