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

import { API_BASE_URL } from '../apiClient/config';

let getAccessToken = () => null;
let getRefreshToken = () => null;
let onTokensRefreshed = () => {};
let onSessionExpired = () => {};

// Language the app is showing ('es' | 'en'). Sent as Accept-Language so the
// Backend writes its error messages in the same language.
let apiLanguage = 'es';
export function setApiLanguage(language) {
  apiLanguage = language === 'en' ? 'en' : 'es';
}

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

// True when the JWT's `exp` is in the past (or within 30s). Any parsing
// problem counts as "not expired" and the normal 401 path handles it.
function isExpired(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(part));
    return typeof exp === 'number' && exp * 1000 < Date.now() + 30_000;
  } catch {
    return false;
  }
}

// The refreshed token reaches React state a render later, so right after a
// refresh getAccessToken() still returns the old one. Remember the new token,
// but only use it while the state still holds the token it replaced (so a
// different user logging in never inherits it).
let renewed = null;
function currentToken() {
  const fromState = getAccessToken();
  return renewed && renewed.replaces === fromState ? renewed.token : fromState;
}

// Refresh is in-flight de-duplication: if several requests 401 at once,
// only one refresh call is made and the rest await it.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError('No refresh token available', 401);

  const staleToken = getAccessToken();
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': apiLanguage },
      body: JSON.stringify({ refreshToken }),
    })
      .then(parseResponse)
      .then((body) => {
        const { accessToken } = body.data;
        renewed = { replaces: staleToken, token: accessToken };
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
  const headers = { 'Content-Type': 'application/json', 'Accept-Language': apiLanguage };

  if (auth) {
    let token = currentToken();
    // The saved token is often already expired when the app opens. Renew it
    // BEFORE sending, so we don't fire a request that is sure to come back 401.
    if (token && isExpired(token) && getRefreshToken()) {
      try {
        token = await refreshAccessToken();
      } catch {
        // Fall through: the request below will 401 and the normal path logs out.
      }
    }
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