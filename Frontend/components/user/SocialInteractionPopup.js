// src/components/user/SocialInteractionPopup.js
//
// The "¿Querés hacer un amigo?" pop-ups. Purely presentational: it renders
// the `view` that social/SocialContext.js keeps (see social/socialReducer.js
// for the phases) and reports what the person pressed.
//
//   ASK / ASK_ACCEPTED  "¿Querés hacer un amigo?"  [Sí] [No]  "súper divertido!"
//                       after Sí the button turns green and says
//                       "te notificaremos cuando te encontremos un amigo"
//   SCAN / CAMERA       "tu amigo te espera! escaneá su QR…"   [ir a cámara]
//   QR                  "tu amigo te espera! dejá que escanee tu QR…"  <QR>
//   DONE / CANCELLED / EXPIRED / ERROR   short result message
//
// The QR is the person's own signed QR (GET /qr/me), fetched once when this
// pop-up opens. The camera is the app's normal QRScanner.

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as qrApi from '../../features/api/services/qr.api';
import QRScanner from '../common/QRScanner';
import { PHASE, isVisible, PAIRING_PHASES } from '../../social/socialReducer';

const GREEN = '#1F9D3A';

const formatTime = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
};

/** Seconds left until `deadline`, re-rendered once a second while `enabled`. */
function useTimeLeft(deadline, enabled) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled, deadline]);
  return Math.max(0, (deadline ?? 0) - now);
}

function Header({ lines, onClose, closeLabel }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTexts}>
        {lines.map((line, idx) => (
          <Text key={idx} style={styles.headerText}>
            {line}
          </Text>
        ))}
      </View>
      <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={closeLabel} style={styles.closeX}>
        <Text style={styles.closeXText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function PopupButton({ label, onPress, green, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.button, green && styles.buttonGreen]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * @param {object|null} view  current pop-up state ({ id, phase, deadline, points, scanError })
 * @param {function} onAccept     "Sí"
 * @param {function} onDecline    "No" or the X (cancels whatever is in progress)
 * @param {function} onOpenCamera "ir a cámara"
 * @param {function} onScanned    (rawQrString) => void
 */
export default function SocialInteractionPopup({ view, onAccept, onDecline, onOpenCamera, onScanned }) {
  const { t } = useTranslation();
  const key = (name, params) => t(`user.popups.socialInteraction.${name}`, params);

  const phase = view?.phase;
  const pairing = PAIRING_PHASES.includes(phase);
  const timeLeft = useTimeLeft(view?.deadline, pairing);

  // Own QR, requested only when this person is the one who shows it.
  const [qrPayload, setQrPayload] = useState(null);
  useEffect(() => {
    if (phase !== PHASE.QR) return undefined;
    let cancelled = false;
    qrApi
      .getMyQR()
      .then((res) => {
        if (!cancelled) setQrPayload(JSON.stringify(res.data));
      })
      .catch(() => {
        if (!cancelled) setQrPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, view?.id]);

  if (!isVisible(view)) return null;

  const close = onDecline;
  let content = null;

  if (phase === PHASE.ASK || phase === PHASE.ASK_ACCEPTED) {
    const accepted = phase === PHASE.ASK_ACCEPTED;
    content = (
      <>
        <Header lines={[key('question')]} onClose={close} closeLabel={key('close')} />
        <View style={styles.body}>
          <View style={styles.buttonRow}>
            <PopupButton label={key('yes')} onPress={onAccept} green={accepted} disabled={accepted} />
            <PopupButton label={key('no')} onPress={onDecline} disabled={accepted} />
          </View>
          <Text style={styles.note}>{accepted ? key('willNotify') : key('fun')}</Text>
        </View>
      </>
    );
  } else if (phase === PHASE.SCAN) {
    content = (
      <>
        <Header lines={[key('friendWaits'), key('scanHeader')]} onClose={close} closeLabel={key('close')} />
        <View style={styles.body}>
          {view.scanError ? <Text style={styles.errorText}>{key('wrongQr')}</Text> : null}
          <PopupButton label={key('goToCamera')} onPress={onOpenCamera} />
          <Text style={styles.timer}>{key('timeLeft', { time: formatTime(timeLeft) })}</Text>
        </View>
      </>
    );
  } else if (phase === PHASE.CAMERA) {
    content = (
      <>
        <Header lines={[key('friendWaits'), key('scanHeader')]} onClose={close} closeLabel={key('close')} />
        <View style={styles.body}>
          <View style={styles.cameraBox}>
            <QRScanner onScanned={onScanned} />
          </View>
          <Text style={styles.timer}>{key('timeLeft', { time: formatTime(timeLeft) })}</Text>
        </View>
      </>
    );
  } else if (phase === PHASE.QR) {
    content = (
      <>
        <Header lines={[key('friendWaits'), key('showHeader')]} onClose={close} closeLabel={key('close')} />
        <View style={styles.body}>
          <View style={styles.qrBox}>
            {qrPayload ? (
              <QRCode value={qrPayload} size={190} />
            ) : (
              <ActivityIndicator color={globals.colors.primary} />
            )}
          </View>
          <Text style={styles.timer}>{key('timeLeft', { time: formatTime(timeLeft) })}</Text>
        </View>
      </>
    );
  } else if (phase === PHASE.DONE) {
    content = (
      <>
        <Header lines={[key('doneTitle')]} onClose={close} closeLabel={key('close')} />
        <View style={styles.body}>
          {view.points > 0 ? <Text style={styles.bigNote}>{key('donePoints', { points: view.points })}</Text> : null}
        </View>
      </>
    );
  } else if (phase === PHASE.CANCELLED) {
    content = (
      <>
        <Header lines={[key('cancelledTitle')]} onClose={close} closeLabel={key('close')} />
        <View style={styles.body}>
          {view.points > 0 ? (
            <Text style={styles.note}>{key('cancelledPoints', { points: view.points })}</Text>
          ) : null}
        </View>
      </>
    );
  } else if (phase === PHASE.EXPIRED) {
    content = (
      <>
        <Header lines={[key('expiredTitle')]} onClose={close} closeLabel={key('close')} />
        <View style={styles.body}>
          <Text style={styles.note}>{key('expiredBody')}</Text>
        </View>
      </>
    );
  } else {
    content = (
      <>
        <Header lines={[key('error')]} onClose={close} closeLabel={key('close')} />
        <View style={styles.body} />
      </>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>{content}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: globals.spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.sm,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: globals.colors.primary,
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexts: {
    alignItems: 'center',
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeX: {
    position: 'absolute',
    top: 8,
    right: 10,
  },
  closeXText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    paddingVertical: globals.spacing.lg,
    paddingHorizontal: globals.spacing.lg,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    backgroundColor: globals.colors.primary,
    paddingVertical: 12,
    borderRadius: globals.radius.sm,
    alignItems: 'center',
    marginHorizontal: 6,
    minWidth: 110,
  },
  buttonGreen: {
    backgroundColor: GREEN,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  note: {
    marginTop: globals.spacing.md,
    color: globals.colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  bigNote: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: 12,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  timer: {
    marginTop: globals.spacing.md,
    color: globals.colors.textMuted,
    fontSize: 12,
  },
  qrBox: {
    padding: globals.spacing.md,
    backgroundColor: '#FFFFFF',
    minHeight: 220,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBox: {
    width: '100%',
    height: 260,
    overflow: 'hidden',
    borderRadius: globals.radius.sm,
    backgroundColor: '#000',
  },
});
