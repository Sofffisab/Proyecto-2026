// src/social/SocialContext.js
//
// Global owner of the real-time social interactions ("¿Querés hacer un
// amigo?"). It lives above the navigator, so the pop-ups appear on whatever
// screen the person is on, as long as they are inside the gym.
//
// "Inside the gym" = between the entry QR scan and the exit QR scan. The
// Backend answers that in GET /social/state (one request on start-up, after
// every entry/exit scan and after every reconnection) — there is no polling.
//
// While inside the gym and without "No aceptar interacciones sociales"
// checked in Edit profile, socialRealtime.js keeps the person in the Ably
// lobby and listens to their private channel; this file turns what arrives
// there into pop-up phases (socialReducer.js) and owns the timers:
//
//   Sí pressed      -> "Buscando un amigo…" for 5 s, then the pop-up closes
//   both said Sí    -> QR for one, camera for the other, 2 minutes to scan
//   2 minutes pass  -> pop-up closes, no points (the Backend enforces it too)
//   close / No      -> cancelled; only the one who accepted gets reduced points
//   scan done       -> "¿Cómo fue tu experiencia?" (optional stars / 👍👎 / Denunciar)

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import Ably from 'ably';
import { useAuth } from '../context/AuthContext';
import * as socialApi from '../features/api/services/social.api';
import * as qrApi from '../features/api/services/qr.api';
import { createSocialRealtime } from './socialRealtime';
import {
  socialReducer,
  PHASE,
  PAIRING_PHASES,
  RESULT_PHASES,
} from './socialReducer';
import SocialInteractionPopup from '../components/user/SocialInteractionPopup';

const CONFIRMATION_MS = 5000; // "te notificaremos…" stays 5 s after pressing Sí
const RESULT_MS = 4000; // cancelled / expired / error messages close by themselves
const FEEDBACK_MS = 90 * 1000; // the "¿Cómo fue tu experiencia?" card waits for the person
const DEFAULT_ROUND_MS = 2 * 60 * 1000;

const SocialContext = createContext({
  view: null,
  inGym: false,
  disabled: false,
  refresh: async () => {},
});

/** True for the HTTP errors that mean "that interaction is over". */
const isGone = (err) => err?.statusCode === 410 || err?.statusCode === 409 || err?.statusCode === 404;

export function SocialProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [view, dispatch] = useReducer(socialReducer, null);
  const [inGym, setInGym] = useState(false);
  const [serverDisabled, setServerDisabled] = useState(false);
  const [roundIntervalMs, setRoundIntervalMs] = useState(DEFAULT_ROUND_MS);

  const viewRef = useRef(view);
  viewRef.current = view;

  const isMember = Boolean(isAuthenticated && user?.id && user?.role === 'USER');
  // The Edit profile checkbox is saved into user.settings, so the switch is
  // instant and needs no extra request; the server value is the fallback.
  const disabled = user?.settings?.disableSocial ?? serverDisabled;
  const active = isMember && inGym && !disabled;

  // ── bootstrap / resync (ONE request) ─────────────────────────────────
  const refresh = useCallback(async () => {
    if (!isMember) return;
    try {
      const { data } = await socialApi.getSocialState();
      setInGym(Boolean(data?.inGym));
      setServerDisabled(Boolean(data?.disabled));
      if (data?.roundIntervalMs) setRoundIntervalMs(data.roundIntervalMs);
      dispatch({ type: 'SYNC', challenge: data?.challenge ?? null });
    } catch {
      // Silent: the next entry/exit scan or reconnection tries again.
    }
  }, [isMember]);

  useEffect(() => {
    if (isMember) {
      refresh();
    } else {
      setInGym(false);
      dispatch({ type: 'CLEAR' });
    }
  }, [isMember, user?.id, refresh]);

  // ── Ably: lobby presence + private inbox + leader election ───────────
  useEffect(() => {
    if (!active) {
      dispatch({ type: 'CLEAR' });
      return undefined;
    }

    const handleEvent = (name, data) => {
      switch (name) {
        case 'invite':
          dispatch({ type: 'INVITE', id: data.challengeId, ttlMs: data.ttlMs });
          break;
        case 'paired':
          dispatch({ type: 'PAIRED', id: data.id, role: data.role, ttlMs: data.ttlMs, partner: data.partner });
          break;
        case 'completed':
          dispatch({ type: 'COMPLETED', id: data.challengeId, points: data.points });
          break;
        case 'cancelled':
          dispatch({ type: 'CANCELLED_BY_PARTNER', id: data.challengeId, points: data.points });
          break;
        case 'expired':
          dispatch({ type: 'EXPIRED', id: data.challengeId });
          break;
        default:
          break;
      }
    };

    const realtime = createSocialRealtime({
      userId: user.id,
      roundIntervalMs,
      createClient: () =>
        new Ably.Realtime({
          // Ably asks for a fresh token by itself before the old one expires.
          authCallback: (_params, callback) => {
            socialApi
              .getAblyToken()
              .then((res) => callback(null, res.data))
              .catch((err) => callback(err, null));
          },
        }),
      tick: socialApi.tick,
      onEvent: handleEvent,
      onReconnect: refresh,
    });

    realtime.start();
    return () => realtime.stop();
  }, [active, user?.id, roundIntervalMs, refresh]);

  // ── timers of the current pop-up ─────────────────────────────────────
  useEffect(() => {
    if (!view) return undefined;
    const { id, phase, deadline } = view;
    const untilDeadline = Math.max(0, (deadline ?? 0) - Date.now());
    let timer = null;

    if (phase === PHASE.ASK_ACCEPTED) {
      timer = setTimeout(() => dispatch({ type: 'HIDE_CONFIRMATION', id }), CONFIRMATION_MS);
    } else if (phase === PHASE.ASK || phase === PHASE.WAITING || PAIRING_PHASES.includes(phase)) {
      // Unanswered invitation -> disappears; QR/camera stage -> "se acabó el tiempo".
      timer = setTimeout(() => dispatch({ type: 'EXPIRED', id }), untilDeadline);
    } else if (phase === PHASE.DONE) {
      timer = setTimeout(() => dispatch({ type: 'CLEAR' }), FEEDBACK_MS);
    } else if (RESULT_PHASES.includes(phase)) {
      timer = setTimeout(() => dispatch({ type: 'CLEAR' }), RESULT_MS);
    }

    return () => timer && clearTimeout(timer);
  }, [view?.id, view?.phase, view?.deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── what the person can do ───────────────────────────────────────────

  /** "Sí" on the first pop-up. */
  const accept = useCallback(async () => {
    const current = viewRef.current;
    if (!current || current.phase !== PHASE.ASK) return;
    const { id } = current;

    dispatch({ type: 'ACCEPT_LOCAL', id });
    try {
      const { data } = await socialApi.respond(id, true);
      if (data?.status === 'ACCEPTED') {
        // The other person was faster: go straight to QR / camera.
        dispatch({ type: 'PAIRED', id, role: data.role, ttlMs: data.ttlMs, partner: data.partner });
      } else if (data?.status === 'REJECTED' || data?.status === 'EXPIRED') {
        dispatch({ type: 'EXPIRED', id });
      }
    } catch (err) {
      dispatch(isGone(err) ? { type: 'EXPIRED', id } : { type: 'ERROR', id });
    }
  }, []);

  /** "No" / the X. On the first pop-up it is "No", later it cancels the interaction. */
  const decline = useCallback(async () => {
    const current = viewRef.current;
    if (!current) return;
    const { id, phase } = current;
    dispatch({ type: 'CLEAR' });
    if (RESULT_PHASES.includes(phase)) return;
    try {
      await socialApi.cancel(id);
    } catch {
      // Already over on the server (expired / cancelled): nothing to undo.
    }
  }, []);

  const openCamera = useCallback(() => dispatch({ type: 'OPEN_CAMERA' }), []);

  /**
   * "Enviar" on "¿Cómo fue tu experiencia?". Closes at once; the request is
   * only made when the person actually chose something (everything is optional).
   */
  const sendFeedback = useCallback(async (feedback) => {
    const current = viewRef.current;
    dispatch({ type: 'CLEAR' });
    const has = feedback && (feedback.rating > 0 || feedback.liked != null || feedback.report);
    if (!current || !has) return;
    try {
      await socialApi.sendFeedback(current.id, {
        ...(feedback.rating > 0 ? { rating: feedback.rating } : {}),
        ...(feedback.liked != null ? { liked: feedback.liked } : {}),
        ...(feedback.report ? { report: true } : {}),
      });
    } catch {
      // Optional and best-effort: nothing to undo if it didn't go through.
    }
  }, []);

  /** The camera read a QR. Only a person's QR can complete the interaction. */
  const scanned = useCallback(async (payload) => {
    const current = viewRef.current;
    if (!current) return;
    const { id } = current;

    // Never forward anything else (a machine QR would start a machine usage).
    let isPersonQr = false;
    try {
      isPersonQr = JSON.parse(payload)?.type === 'USER';
    } catch {
      isPersonQr = false;
    }
    if (!isPersonQr) {
      dispatch({ type: 'SCAN_FAILED', reason: 'wrongQr' });
      return;
    }

    try {
      const { data } = await qrApi.scanQR(payload);
      dispatch({ type: 'COMPLETED', id, points: data?.points ?? 0 });
    } catch (err) {
      if (isGone(err)) dispatch({ type: 'EXPIRED', id });
      else dispatch({ type: 'SCAN_FAILED', reason: 'wrongQr' });
    }
  }, []);

  const value = useMemo(
    () => ({ view, inGym, disabled, refresh }),
    [view, inGym, disabled, refresh]
  );

  return (
    <SocialContext.Provider value={value}>
      {children}
      <SocialInteractionPopup
        view={view}
        onAccept={accept}
        onDecline={decline}
        onOpenCamera={openCamera}
        onScanned={scanned}
        onFeedback={sendFeedback}
      />
    </SocialContext.Provider>
  );
}

export function useSocial() {
  return useContext(SocialContext);
}

export default SocialContext;
