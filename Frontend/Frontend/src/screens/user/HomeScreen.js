import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Footer from '../../components/common/Footer';
import QRScanner from '../../components/common/QRScanner';
import SocialInteractionPopup from './popups/SocialInteractionPopup';
import RateTrainerPopup from './popups/RateTrainerPopup';
import { useTranslation } from '../../i18n/I18nContext';
import * as gamificationApi from '../../api/services/gamification.api';
import * as qrApi from '../../api/services/qr.api';
import * as assistanceApi from '../../api/services/assistance.api';

/**
 * Main Screen (User) - spec section 3.
 * Components: points counter, QR camera button, access to History,
 * Routines, Achievements & Goals, Reports, Ask for Help, Settings, Wrapped,
 * and log out / switch account.
 *
 * Points (GET /gamification/points), QR scan (POST /qr/scan) and Ask for
 * Help (POST /assistance/request) are fetched/called directly from this
 * screen, same convention as Onboarding/Settings own their PUT /users/me
 * calls — the navigator only wires plain navigation callbacks.
 *
 * @param {function} [onGoToHistory]
 * @param {function} [onGoToRoutines]
 * @param {function} [onGoToAchievementsGoals]
 * @param {function} [onGoToReports] - navigates to the Reports Screen (spec section 3)
 * @param {function} [onGoToSettings]
 * @param {function} [onGoToWrapped]
 * @param {function} [onLogout] - opens "are you sure?" pop-up
 * @param {function} [onBack]
 */
export default function HomeScreen({
  onGoToHistory,
  onGoToRoutines,
  onGoToAchievementsGoals,
  onGoToReports,
  onGoToSettings,
  onGoToWrapped,
  onLogout,
  onBack,
}) {
  const { t } = useTranslation();
  // These 2 pop-ups appear at moments decided by the backend (random /
  // end of day), there's no real trigger button for them yet. They're
  // handled here as local state, since they're pop-ups (not screens)
  // and don't need their own entry in the navigation stack.
  const [showSocialInteraction, setShowSocialInteraction] = useState(false);
  const [showRateTrainer, setShowRateTrainer] = useState(false);

  // GET /gamification/points — refetched every time this screen regains
  // focus (e.g. coming back from Routines after a machine scan awarded
  // points), not just on first mount.
  const [points, setPoints] = useState(0);
  const [pointsLoading, setPointsLoading] = useState(true);

  const loadPoints = useCallback(async () => {
    try {
      setPointsLoading(true);
      const { data } = await gamificationApi.getPoints();
      setPoints(data?.totalPoints ?? 0);
    } catch {
      // Best-effort: keep the last known value on screen instead of
      // blocking the whole Home screen over a transient network error.
    } finally {
      setPointsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPoints();
    }, [loadPoints])
  );

  // QR scan flow — real camera via expo-camera (see QRScanner component).
  // The Backend auto-detects entry/exit/machine/interaction from the
  // scanned payload itself (see Backend/src/services/verification.service.js
  // #processScan); the client only forwards the raw scanned string.
  const [showScanQR, setShowScanQR] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null); // { type: 'success' | 'error', message }

  const closeScanQR = () => {
    setShowScanQR(false);
    setScanFeedback(null);
  };

  const handleScanned = async (payload) => {
    try {
      setScanLoading(true);
      setScanFeedback(null);
      const { data } = await qrApi.scanQR(payload);
      setScanFeedback({ type: 'success', message: data?.message || t('user.home.scanSuccess') });
      loadPoints();
    } catch (err) {
      setScanFeedback({ type: 'error', message: err.message || t('user.home.scanError') });
    } finally {
      setScanLoading(false);
    }
  };

  // Ask for Help flow (POST /assistance/request). Fire-and-confirm: the
  // Backend picks/prioritizes the trainer and pushes the notification to
  // them (spec section 3), so the member just gets a confirmation here.
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpFeedback, setHelpFeedback] = useState(null);

  const handleAskForHelp = async () => {
    try {
      setHelpLoading(true);
      setHelpFeedback(null);
      await assistanceApi.requestAssistance();
      setHelpFeedback({ type: 'success', message: t('user.home.helpRequested') });
    } catch (err) {
      setHelpFeedback({ type: 'error', message: err.message || t('user.home.helpError') });
    } finally {
      setHelpLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.home.title')} subtitle={t('user.home.subtitle')} />

      <ScrollView style={styles.content}>
        <Card
          title={t('user.home.pointsAccumulated')}
          content={pointsLoading ? t('user.home.pointsLoading') : String(points)}
        />

        <View style={styles.buttonGroup}>
          <Button label={t('user.home.scanQR')} onPress={() => setShowScanQR(true)} />
          <Button label={t('user.home.history')} onPress={onGoToHistory} variant="secondary" />
          <Button label={t('user.home.routines')} onPress={onGoToRoutines} variant="secondary" />
          <Button label={t('user.home.achievementsGoals')} onPress={onGoToAchievementsGoals} variant="secondary" />
          <Button label={t('user.home.reports')} onPress={onGoToReports} variant="secondary" />
          <Button
            label={helpLoading ? t('user.home.pedirAyudaLoading') : t('user.home.pedirAyuda')}
            onPress={handleAskForHelp}
            variant="secondary"
            disabled={helpLoading}
          />
          {helpFeedback && (
            <Text style={helpFeedback.type === 'error' ? styles.errorText : styles.successText}>
              {helpFeedback.message}
            </Text>
          )}
          <Button label={t('user.home.settings')} onPress={onGoToSettings} variant="secondary" />
          <Button label={t('user.home.wrapped')} onPress={onGoToWrapped} variant="secondary" />
          <Button label={t('user.home.logout')} onPress={onLogout} variant="danger" />
        </View>

        {/* For testing: these pop-ups don't have a real trigger yet
            (the backend decides when to show them), so these buttons
            are added just to be able to see and test them. */}
        <View style={styles.buttonGroup}>
          <Button
            label={t('user.home.testSocialInteraction')}
            onPress={() => setShowSocialInteraction(true)}
            variant="secondary"
          />
          <Button
            label={t('user.home.testRateTrainer')}
            onPress={() => setShowRateTrainer(true)}
            variant="secondary"
          />
        </View>

        <Text style={styles.backLink} onPress={onBack}>{t('user.home.back')}</Text>
      </ScrollView>

      <Footer
        onNavigateHome={onBack}
        onNavigateProfile={onGoToSettings}
        onLogout={onLogout}
      />

      <Modal
        visible={showSocialInteraction}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSocialInteraction(false)}
      >
        <SocialInteractionPopup
          onNo={() => setShowSocialInteraction(false)}
          onYes={() => setShowSocialInteraction(false)}
          onClose={() => setShowSocialInteraction(false)}
        />
      </Modal>

      <Modal
        visible={showRateTrainer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRateTrainer(false)}
      >
        <RateTrainerPopup
          onRate={() => setShowRateTrainer(false)}
          onReportNotHelped={() => setShowRateTrainer(false)}
          onClose={() => setShowRateTrainer(false)}
        />
      </Modal>

      {/* QR scan pop-up — real camera (expo-camera) via the QRScanner
          component; POST /qr/scan is called as soon as a code is read. */}
      <Modal
        visible={showScanQR}
        animationType="slide"
        onRequestClose={closeScanQR}
      >
        <View style={styles.scannerContainer}>
          <QRScanner onScanned={handleScanned} onClose={closeScanQR} />
          {(scanLoading || scanFeedback) && (
            <View style={styles.scanFeedbackBar}>
              {scanLoading && <Text style={styles.scanFeedbackText}>{t('user.home.scanning')}</Text>}
              {!scanLoading && scanFeedback && (
                <>
                  <Text
                    style={
                      scanFeedback.type === 'error'
                        ? [styles.scanFeedbackText, styles.errorText]
                        : [styles.scanFeedbackText, styles.successText]
                    }
                  >
                    {scanFeedback.message}
                  </Text>
                  <Button label={t('common.close')} onPress={closeScanQR} />
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    flex: 1,
    padding: globals.spacing.md,
  },
  buttonGroup: {
    marginTop: globals.spacing.md,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanFeedbackBar: {
    backgroundColor: globals.colors.secondary,
    padding: globals.spacing.lg,
  },
  scanFeedbackText: {
    textAlign: 'center',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
});
