// src/api/client.js
//
// Thin fetch wrapper for the Backend API (see Backend/src/server.js /
// Backend/src/routes/index.js).
//
// Responsibilities:
//   - Prefix every call with API_BASE_URL
//   - Attach "Authorization: Bearer <accessToken>" automatically
//   - Parse the Backend's uniform JSON envelope: { success, data, message }
//     (see Backend/src/middlewares/error.middleware.js and every controller)
//   - On a 401 (expired access token), silently try POST /auth/refresh-token
//     once, then retry the original request. If that also fails, force a
//     logout so the app falls back to the Login screen.
//   - Throw a plain Error whose .message is the Backend's message and whose
//     .statusCode / .code mirror the response, so screens can show
//     err.message directly (LoginScreen already expects this shape).
//
// Token storage/refresh is wired in from AuthContext via configureApiClient,
// to avoid a circular import between client.js and AuthContext.js.

import { API_BASE_URL } from './config';

let getAccessToken = () => null;
let getRefreshToken = () => null;
let onTokensRefreshed = () => {};
let onSessionExpired = () => {};

/**
 * Called once by AuthContext so this module can read/update tokens without
 * importing AuthContext directly (would create a circular import, since
 * AuthContext itself calls the api services which use this client).
 */
export function configureApiClient({
  getAccessToken: getAccess,
  getRefreshToken: getRefresh,
  onTokensRefreshed: onRefreshed,
  onSessionExpired: onExpired,
}) {
  if (getAccess) getAccessToken = getAccess;
  if (getRefresh) getRefreshToken = getRefresh;
  if (onRefreshed) onTokensRefreshed = onRefreshed;
  if (onExpired) onSessionExpired = onExpired;
}

class ApiError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function parseResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response (e.g. network-level HTML error page)
  }

  if (!response.ok) {
    const message = body?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body?.code);
  }

  return body;
}

// Refresh is in-flight de-duplication: if several requests 401 at once,
// only one refresh call is made and the rest await it.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError('No refresh token available', 401);

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(parseResponse)
      .then((body) => {
        const { accessToken } = body.data;
        onTokensRefreshed({ accessToken });
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

/**
 * Core request function.
 * @param {string} path - e.g. "/auth/login" or "/users/me"
 * @param {object} options
 * @param {string} options.method
 * @param {object} [options.body]
 * @param {boolean} [options.auth=true] - attach Authorization header
 * @param {boolean} [options.isRetry] - internal flag, don't refresh again
 */
async function request(path, { method = 'GET', body, auth = true, isRetry = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && auth && !isRetry) {
    try {
      await refreshAccessToken();
      return request(path, { method, body, auth, isRetry: true });
    } catch {
      onSessionExpired();
      throw new ApiError('Session expired, please log in again', 401, 'SESSION_EXPIRED');
    }
  }

  return parseResponse(response);
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export { ApiError };
