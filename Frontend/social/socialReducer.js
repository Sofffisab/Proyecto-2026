// src/social/socialReducer.js
//
// State machine of the social-interaction pop-ups. Pure (no React, no timers,
// no network) — SocialContext.js feeds it events and owns the timers.
//
//   ASK            "¿Querés hacer un amigo?"  Sí / No
//   ASK_ACCEPTED   Sí pressed: button turns green + "te notificaremos…" (5 s)
//   WAITING        pop-up closed, waiting for the other person's answer
//   QR             both said Yes, I was first  -> I show my QR
//   SCAN           both said Yes, I was second -> I get the camera button
//   CAMERA         camera open, scanning their QR (a wrong QR goes back to SCAN)
//   DONE           scanned correctly: points given, closes
//   CANCELLED      the other person closed it (maybe I get reduced points)
//   EXPIRED        2 minutes passed without scanning: no points
//   ERROR          something failed talking to the server

export const PHASE = {
  ASK: 'ASK',
  ASK_ACCEPTED: 'ASK_ACCEPTED',
  WAITING: 'WAITING',
  QR: 'QR',
  SCAN: 'SCAN',
  CAMERA: 'CAMERA',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  ERROR: 'ERROR',
};

// Phases in which the pop-up is on screen.
export const VISIBLE_PHASES = [
  PHASE.ASK,
  PHASE.ASK_ACCEPTED,
  PHASE.QR,
  PHASE.SCAN,
  PHASE.CAMERA,
  PHASE.DONE,
  PHASE.CANCELLED,
  PHASE.EXPIRED,
  PHASE.ERROR,
];

// The challenge is still alive on the server in these phases.
export const OPEN_PHASES = [
  PHASE.ASK,
  PHASE.ASK_ACCEPTED,
  PHASE.WAITING,
  PHASE.QR,
  PHASE.SCAN,
  PHASE.CAMERA,
];

// "Pairing" = both said Yes, QR/camera stage.
export const PAIRING_PHASES = [PHASE.QR, PHASE.SCAN, PHASE.CAMERA];

// Final messages that close themselves.
export const RESULT_PHASES = [PHASE.DONE, PHASE.CANCELLED, PHASE.EXPIRED, PHASE.ERROR];

export const isVisible = (view) => Boolean(view && VISIBLE_PHASES.includes(view.phase));

/** View for a challenge coming from the server (GET /social/state or an answer). */
function viewFromChallenge(challenge, now) {
  const deadline = now + (challenge.ttlMs ?? 0);
  if (challenge.status === 'ACCEPTED') {
    return {
      id: challenge.id,
      phase: challenge.role === 'SHOW_QR' ? PHASE.QR : PHASE.SCAN,
      deadline,
    };
  }
  return {
    id: challenge.id,
    phase: challenge.accepted ? PHASE.WAITING : PHASE.ASK,
    deadline,
  };
}

export function socialReducer(view, action) {
  const now = action.now ?? Date.now();

  switch (action.type) {
    case 'INVITE':
      // One interaction at a time; a second invite is simply left to expire.
      if (view) return view;
      return { id: action.id, phase: PHASE.ASK, deadline: now + (action.ttlMs ?? 0) };

    // "Sí" pressed (optimistic, before the server answers).
    case 'ACCEPT_LOCAL':
      if (!view || view.id !== action.id || view.phase !== PHASE.ASK) return view;
      return { ...view, phase: PHASE.ASK_ACCEPTED };

    // 5 s after "Sí" the confirmation closes by itself (or by its X).
    case 'HIDE_CONFIRMATION':
      if (!view || view.id !== action.id || view.phase !== PHASE.ASK_ACCEPTED) return view;
      return { ...view, phase: PHASE.WAITING };

    // Both accepted: QR for the first one, camera for the second.
    case 'PAIRED': {
      if (view && view.id !== action.id) return view;
      if (view && RESULT_PHASES.includes(view.phase)) return view;
      if (view && PAIRING_PHASES.includes(view.phase)) return view; // duplicate event
      return {
        id: action.id,
        phase: action.role === 'SHOW_QR' ? PHASE.QR : PHASE.SCAN,
        deadline: now + (action.ttlMs ?? 0),
      };
    }

    case 'OPEN_CAMERA':
      if (!view || view.phase !== PHASE.SCAN) return view;
      return { ...view, phase: PHASE.CAMERA, scanError: null };

    // Scanned something that isn't my partner's QR: back to the camera
    // button (with a hint) — the 2 minutes keep running.
    case 'SCAN_FAILED':
      if (!view || view.phase !== PHASE.CAMERA) return view;
      return { ...view, phase: PHASE.SCAN, scanError: action.reason ?? 'invalid' };

    case 'COMPLETED':
      if (!view || view.id !== action.id || view.phase === PHASE.DONE) return view;
      return { ...view, phase: PHASE.DONE, points: action.points ?? view.points ?? 0 };

    // The OTHER person pressed No / closed. Only worth a message when it
    // interrupts the QR stage or when I get reduced points for it.
    case 'CANCELLED_BY_PARTNER':
      if (!view || view.id !== action.id) return view;
      if ((action.points ?? 0) > 0 || PAIRING_PHASES.includes(view.phase)) {
        return { ...view, phase: PHASE.CANCELLED, points: action.points ?? 0 };
      }
      return null;

    case 'EXPIRED':
      if (!view || (action.id && view.id !== action.id)) return view;
      if (PAIRING_PHASES.includes(view.phase)) return { ...view, phase: PHASE.EXPIRED };
      return null; // an unanswered invitation just disappears

    case 'ERROR':
      if (!view || view.id !== action.id) return view;
      return { ...view, phase: PHASE.ERROR };

    // Reconcile with what the server says (start-up / reconnect).
    case 'SYNC': {
      const { challenge } = action;
      if (!challenge) {
        return view && OPEN_PHASES.includes(view.phase) ? null : view;
      }
      if (!view) return viewFromChallenge(challenge, now);
      if (view.id !== challenge.id) return view;
      if (challenge.status === 'ACCEPTED' && !PAIRING_PHASES.includes(view.phase)) {
        return viewFromChallenge(challenge, now);
      }
      return view;
    }

    case 'CLEAR':
      return null;

    default:
      return view;
  }
}
