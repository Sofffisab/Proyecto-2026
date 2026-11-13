// src/screens/user/CameraScreen.js
//
// QR scanner opened from the camera buttons of the free-mode and
// step-by-step ("seguir rutina") screens. Reads a QR (machine, entry/exit,
// user) and forwards it to POST /qr/scan, showing the result.

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import QRScanner from '../../components/common/QRScanner';
import * as qrApi from '../../features/api/services/qr.api';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * @param {function} [onBack]
 */
export default function CameraScreen({ onBack }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }

  const handleScanned = useCallback(async (payload) => {
    try {
      setLoading(true);
      setFeedback(null);
      const { data } = await qrApi.scanQR(payload);
      setFeedback({ type: 'success', message: data?.message || t('user.home.scanSuccess') });
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || t('user.home.scanError') });
      return 'retry';
    } finally {
      setLoading(false);
    }
  }, [t]);

  return (
    <View style={styles.container}>
      <QRScanner onScanned={handleScanned} onClose={onBack} />
      {(loading || feedback) && (
        <View style={styles.feedbackBar}>
          {loading && <Text style={styles.feedbackText}>{t('user.home.scanning')}</Text>}
          {!loading && feedback && (
            <>
              <Text
                style={[
                  styles.feedbackText,
                  { color: feedback.type === 'error' ? globals.colors.danger : globals.colors.text },
                ]}
              >
                {feedback.message}
              </Text>
              {feedback.type === 'success' && (
                <TouchableOpacity style={styles.button} onPress={onBack}>
                  <Text style={styles.buttonLabel}>{t('common.close')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  feedbackBar: {
    backgroundColor: globals.colors.secondary,
    padding: globals.spacing.lg,
  },
  feedbackText: { textAlign: 'center', color: globals.colors.text, marginBottom: globals.spacing.sm },
  button: {
    alignSelf: 'center',
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.lg,
  },
  buttonLabel: { color: '#fff', fontWeight: '600' },
});
