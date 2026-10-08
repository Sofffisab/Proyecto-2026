// src/context/AuthContext.js
//
// Holds the authenticated session (user + tokens) for the whole app and
// persists it to AsyncStorage so the person doesn't have to log in again
// every time the app is reopened.
//
// Wires itself into src/api/client.js via configureApiClient so every API
// call automatically carries the current access token, and so a failed
// silent refresh (refresh token expired/invalid) logs the person out and
// falls back to the Login screen.
//
// Real backend routes used (see Backend/src/routes/index.js):
//   POST /auth/login, POST /auth/logout,
//   (there is no self-registration endpoint — accounts are admin-created only)
//   POST /auth/refresh-token, GET /users/me

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureApiClient, ApiError } from '../api/client';
import * as authApi from '../api/services/auth.api';
import * as userApi from '../api/services/user.api';

// Defensive client-side strip: PUT /users/me (Backend/src/controllers/
// user.controller.js#updateMe) returns the raw Prisma row, which includes
// passwordHash/passwordResetToken. Never let those reach local state.
function sanitizeUserFields(rawUser) {
  const { passwordHash, passwordResetToken, passwordResetExpires, ...safe } = rawUser;
  return safe;
}

const STORAGE_KEY = '@gymapp/session';

const AuthContext = createContext({
  isReady: false,
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  forgotPassword: async () => {},
  verifyResetCode: async () => {},
  resetPassword: async () => {},
  changePassword: async () => {},
  refreshMe: async () => {},
  updateLocalUser: () => {},
});

export function AuthProvider({ children }) {
  // isReady: false while restoring a persisted session from AsyncStorage on
  // app boot, to avoid flashing the Login screen before we know the answer.
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState(null);

  const persistSession = useCallback(async (session) => {
    if (session) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearSession = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    setRefreshTokenValue(null);
    await persistSession(null);
  }, [persistSession]);

  const applySession = useCallback(
    async ({ user: nextUser, accessToken: nextAccess, refreshToken: nextRefresh }) => {
      setUser(nextUser);
      setAccessToken(nextAccess);
      setRefreshTokenValue(nextRefresh);
      await persistSession({ user: nextUser, accessToken: nextAccess, refreshToken: nextRefresh });
    },
    [persistSession]
  );

  // Restore persisted session on app boot.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setUser(saved.user ?? null);
          setAccessToken(saved.accessToken ?? null);
          setRefreshTokenValue(saved.refreshToken ?? null);
        }
      } catch {
        // Corrupted storage entry: proceed as logged out rather than crash.
        await persistSession(null);
      } finally {
        setIsReady(true);
      }
    })();
  }, [persistSession]);

  // Wire this context into the raw API client (see api/client.js for why:
  // avoids a circular import between the client and this context).
  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessToken,
      getRefreshToken: () => refreshTokenValue,
      onTokensRefreshed: ({ accessToken: newAccess }) => {
        setAccessToken(newAccess);
        // Persist immediately so a refreshed token survives an app restart.
        // Built from state already in this closure (user/refreshTokenValue)
        // instead of a get-then-set round trip — see updateLocalUser above
        // for why that pattern is unsafe when writes can overlap.
        persistSession({ user, accessToken: newAccess, refreshToken: refreshTokenValue });
      },
      onSessionExpired: () => {
        clearSession();
      },
    });
  }, [accessToken, refreshTokenValue, user, clearSession, persistSession]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await authApi.login({ email, password });
      await applySession(data);
      return data.user;
    },
    [applySession]
  );


  // POST /auth/forgot-password — no session required. Always resolves the
  // same way regardless of whether the email exists (Backend never reveals
  // account existence), so the Forgot Password screen can show one generic
  // confirmation message either way.
  const forgotPassword = useCallback(async (email) => {
    await authApi.forgotPassword(email);
  }, []);

  // POST /auth/verify-reset-code — no session required. Confirms the code
  // from the email is correct before the Forgot Password screen lets the
  // person move on to choosing a new password.
  const verifyResetCode = useCallback(async ({ email, code }) => {
    await authApi.verifyResetCode({ email, code });
  }, []);

  // POST /auth/reset-password — completes the "Recuperar contraseña" flow:
  // token received by mail + the new password the user chose.
  const resetPassword = useCallback(async ({ token, newPassword }) => {
    await authApi.resetPassword({ token, newPassword });
  }, []);

  // PATCH /users/me/password — "cambiar contraseña" from within Settings,
  // while already logged in (different from the forgot/reset flow above).
  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    await userApi.changePassword({ currentPassword, newPassword });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (accessToken) await authApi.logout();
    } catch {
      // Even if the server call fails (e.g. offline), still clear locally
      // so the person isn't stuck unable to log out.
    } finally {
      await clearSession();
    }
  }, [accessToken, clearSession]);

  // Re-fetches the current user from the Backend (GET /users/me) and
  // updates both state and storage. Useful after onboarding/profile edits.
  const refreshMe = useCallback(async () => {
    const { data } = await authApi.getMe();
    setUser(data);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    await persistSession({ ...saved, user: data });
    return data;
  }, [persistSession]);

  // Cheap local-only update (e.g. optimistic UI) without a round trip.
  //
  // IMPORTANT: this used to read the persisted session back from
  // AsyncStorage before re-writing it (get-then-set). That's a race: when
  // two updates fire back-to-back (e.g. SettingsScreen's onSave calls
  // updateProfile() then updateSettings() in sequence), the second one's
  // AsyncStorage.getItem() can resolve BEFORE the first one's write has
  // landed, so it persists a stale copy that clobbers the just-saved
  // profile fields. The in-memory `user` state stayed correct (that's why
  // the change was visible immediately after saving), but the persisted
  // copy didn't — so a reload/reopen showed the old data.
  //
  // Fix: build the full session to persist from state that's already in
  // this closure (accessToken/refreshTokenValue) instead of round-tripping
  // through storage, so each call is a single atomic write.
  const updateLocalUser = useCallback(
    (patch) => {
      setUser((prev) => {
        const next = { ...prev, ...patch };
        persistSession({ user: next, accessToken, refreshToken: refreshTokenValue });
        return next;
      });
    },
    [persistSession, accessToken, refreshTokenValue]
  );

  // PUT /users/me — used by Onboarding and Settings screens. Note: for a
  // USER role, GET /users/me (refreshMe) strips medicalConditions/objectives/
  // deliveryAddress server-side (see Backend/src/services/user.service.js
  // #getById), so we intentionally merge THIS response into local state
  // instead of calling refreshMe afterwards, or those fields would vanish
  // from the in-memory user right after saving them.
  const updateProfile = useCallback(
    async (patch) => {
      const { data } = await userApi.updateProfile(patch);
      const safe = sanitizeUserFields(data);
      updateLocalUser(safe);
      return safe;
    },
    [updateLocalUser]
  );

  // PATCH /users/me/settings — returns the UserSettings row, stored under
  // user.settings to match the shape GET /users/me returns (which includes
  // `settings` via Prisma `include`, see user.service.js#getById).
  const updateSettings = useCallback(
    async (patch) => {
      const { data } = await userApi.updateSettings(patch);
      updateLocalUser({ settings: data });
      return data;
    },
    [updateLocalUser]
  );

  const value = useMemo(
    () => ({
      isReady,
      user,
      accessToken,
      refreshToken: refreshTokenValue,
      isAuthenticated: Boolean(accessToken && user),
      login,
      logout,
      forgotPassword,
      verifyResetCode,
      resetPassword,
      changePassword,
      refreshMe,
      updateLocalUser,
      updateProfile,
      updateSettings,
    }),
    [
      isReady,
      user,
      accessToken,
      refreshTokenValue,
      login,
      logout,
      forgotPassword,
      verifyResetCode,
      resetPassword,
      changePassword,
      refreshMe,
      updateLocalUser,
      updateProfile,
      updateSettings,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export { ApiError };
export default AuthContext;
