// src/screens/user/popups/SocialInteractionPopup.js
//
// Social Interaction Pop-up - spec section 3.
// "Pregunta: ¿Quieres? ... Botón Sí: Verifica si el otro acepta. Si el
// otro dice no, se cierra. Si el otro dice sí, indica en pantalla quién
// debe escanear a quién y aparece en uno la función cámara y en otro le
// trae su qr."
//
// Backend wiring:
//   - PATCH /challenges/:id/join   -> accept   (challenge.api.js)
//   - PATCH /challenges/:id/cancel -> reject   (challenge.api.js)
//   - GET /qr/me                   -> own QR to display (qr.api.js)
//   - QRScanner + POST /qr/scan    -> the scanning half of the pairing;
//     the Backend auto-completes the challenge once it recognizes a
//     "USER" type QR from an ACCEPTED challenge partner (see
//     verification.service.js#processScan) — no separate "complete" call.
//
// Role assignment ("quién debe escanear a quién"): the challenge's
// initiator (challenge.userId, auto-assigned by the Backend job) scans;
// the challenged partner shows their QR. This is a stable, deterministic
// split — it doesn't matter who happens to open the pop-up first.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import globals from '../../../styles/globals';
import { useTranslation } from '../../../i18n/I18nContext';
import * as challengeApi from '../../../api/services/challenge.api';
import * as qrApi from '../../../api/services/qr.api';
import QRScanner from '../../../components/common/QRScanner';

const PHASE = {
  ASK: 'ASK',
  WAITING: 'WAITING',
  PAIRING_SCAN: 'PAIRING_SCAN',
  PAIRING_SHOW: 'PAIRING_SHOW',
  DONE: 'DONE',
};

/**
 * @param {object} challenge - The active SocialChallenge for this user,
 *   e.g. from challengeApi.getActiveChallenges(): { id, userId, partnerUserId, status }.
 * @param {string} currentUserId - The signed-in user's id, used to decide
 *   the scan-vs-show role.
 * @param {function} [onDone] - Called once pairing/rejection finishes.
 * @param {function} [onClose] - Close button (global pop-up rule).
 */
export default function SocialInteractionPopup({ challenge, currentUserId, onDone, onClose }) {
  const { t } = useTranslation();

  const [phase, setPhase] = useState(PHASE.ASK);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrPayload, setQrPayload] = useState(null);

  const isInitiator = challenge?.userId === currentUserId;

  const handleNo = async () => {
    if (!challenge?.id) {
      onClose && onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await challengeApi.cancelChallenge(challenge.id);
    } catch (err) {
      setError(err.message || t('user.popups.socialInteraction.error'));
    } finally {
      setSubmitting(false);
      onClose && onClose();
    }
  };

  const handleYes = async () => {
    if (!challenge?.id) {
      setError(t('user.popups.socialInteraction.expired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await challengeApi.acceptChallenge(challenge.id);

      if (isInitiator) {
        setPhase(PHASE.PAIRING_SCAN);
      } else {
        const res = await qrApi.getMyQR();
        setQrPayload(JSON.stringify(res.data));
        setPhase(PHASE.PAIRING_SHOW);
      }
    } catch (err) {
      setError(err.message || t('user.popups.socialInteraction.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleScanned = async (data) => {
    setSubmitting(true);
    setError(null);
    try {
      const { scanQR } = qrApi;
      await scanQR(data);
      setPhase(PHASE.DONE);
      if (onDone) onDone();
    } catch (err) {
      setError(err.message || t('user.popups.socialInteraction.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === PHASE.PAIRING_SCAN) {
    return (
      <View style={styles.overlay}>
        <View style={styles.scannerCard}>
          <Text style={styles.title}>{t('user.popups.socialInteraction.youScan')}</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <QRScanner onScanned={handleScanned} onClose={onClose} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {phase === PHASE.ASK && (
          <>
            <Text style={styles.title}>{t('user.popups.socialInteraction.question')}</Text>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {submitting ? (
              <ActivityIndicator color={globals.colors.primary} />
            ) : (
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.noButton} onPress={handleNo}>
                  <Text style={styles.noButtonText}>{t('user.popups.socialInteraction.no')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.yesButton} onPress={handleYes}>
                  <Text style={styles.yesButtonText}>{t('user.popups.socialInteraction.yes')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {phase === PHASE.PAIRING_SHOW && (
          <>
            <Text style={styles.title}>{t('user.popups.socialInteraction.showYourQR')}</Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
            {qrPayload && (
              <View style={styles.qrBox}>
                <QRCode value={qrPayload} size={200} />
              </View>
            )}
          </>
        )}

        {phase === PHASE.DONE && (
          <Text style={styles.title}>{t('user.popups.socialInteraction.accepted')}</Text>
        )}

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeLink}>{t('user.popups.socialInteraction.close')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.lg,
    alignItems: 'center',
  },
  scannerCard: {
    width: '90%',
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  noButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
    marginRight: globals.spacing.sm,
  },
  noButtonText: {
    color: globals.colors.text,
    fontWeight: '600',
  },
  yesButton: {
    flex: 1,
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    alignItems: 'center',
    marginLeft: globals.spacing.sm,
  },
  yesButtonText: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  qrBox: {
    marginVertical: globals.spacing.md,
    padding: globals.spacing.md,
    backgroundColor: globals.colors.secondary,
    borderRadius: globals.radius.md,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  closeLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginTop: globals.spacing.md,
  },
});
