import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import QRScanner from '../../components/common/QRScanner';
import SocialInteractionPopup from './popups/SocialInteractionPopup';
import RateTrainerPopup from './popups/RateTrainerPopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import * as gamificationApi from '../../api/services/gamification.api';
import * as qrApi from '../../api/services/qr.api';
import * as assistanceApi from '../../api/services/assistance.api';
import * as notificationApi from '../../api/services/notification.api';
import * as challengeApi from '../../api/services/challenge.api';
import { flushQueue } from '../../offline/offlineQueue';

/**
 * Main Screen (User) - spec section 3.
 * Components: points counter, QR camera button, access to History,
 * Routines, Achievements & Goals, Reports, Ask for Help, Settings, Wrapped,
 * and log out / switch account.
 *
 * QR scan (POST /qr/scan, via qr.api.js) auto-detects entry/exit/machine/
 * interaction server-side (verification.service.js#processScan) and
 * returns which one it was:
 *   - ENTRY_EXIT -> { action: 'CHECK_IN' | 'CHECK_OUT', session }
 *     CHECK_IN shows a plain "arrival successful" pop-up (spec section 3's
 *     scan logic). CHECK_OUT triggers the Rate Trainer(s) pop-up chain,
 *     but only if this user actually received help today (checked via
 *     GET /assistance/history) — matches "si recibió ayuda" in the spec.
 *   - MACHINE / USER (social challenge pairing) -> generic success/error
 *     feedback bar, same as before.
 *
 * @param {function} [onGoToHistory]
 * @param {function} [onGoToRoutines]
 * @param {function} [onGoToAchievementsGoals]
 * @param {function} [onGoToReports] - navigates to the Reports Screen (spec section 3)
 * @param {function} [onGoToSettings]
 * @param {function} [onGoToWrapped]
 * @param {function} [onGoToNotifications]
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
  onGoToNotifications,
  onLogout,
  onBack,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // The Social Interaction pop-up appears at a random moment decided by
  // the Backend (jobs/challenge.job.js assigns a SocialChallenge); there's
  // no real trigger button for it. It's surfaced here by polling the
  // active-challenge endpoint on focus, same idea as unread notifications.
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [showSocialInteraction, setShowSocialInteraction] = useState(false);

  // Rate Trainer(s) pop-up state — opened from the CHECK_OUT branch of
  // handleScanned below, not from a button.
  const [showRateTrainer, setShowRateTrainer] = useState(false);
  const [rateTrainerSessionId, setRateTrainerSessionId] = useState(null);
  const [rateTrainerList, setRateTrainerList] = useState([]);

  // "Arrival successful" pop-up — CHECK_IN branch of handleScanned.
  const [showCheckInSuccess, setShowCheckInSuccess] = useState(false);

  // GET /gamification/points — refetched every time this screen regains
  // focus (e.g. coming back from Routines after a machine scan awarded
  // points), not just on first mount.
  const [points, setPoints] = useState(0);
  const [pointsLoading, setPointsLoading] = useState(true);

  const [unreadCount, setUnreadCount] = useState(0);

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

  const loadUnreadCount = useCallback(async () => {
    try {
      const { data } = await notificationApi.getUnreadCount();
      setUnreadCount(data?.count ?? 0);
    } catch {
      // Silent — the bell just won't show a badge this time.
    }
  }, []);

  const loadActiveChallenge = useCallback(async () => {
    try {
      const { data } = await challengeApi.getActiveChallenges();
      const assigned = (data ?? []).find((c) => c.status === 'ASSIGNED');
      setActiveChallenge(assigned ?? null);
      setShowSocialInteraction(Boolean(assigned));
    } catch {
      // Silent — no pop-up if we can't tell.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPoints();
      loadUnreadCount();
      loadActiveChallenge();
      // Best-effort silent retry of anything queued while offline.
      flushQueue();
    }, [loadPoints, loadUnreadCount, loadActiveChallenge])
  );

  // QR scan flow — real camera via expo-camera (see QRScanner component).
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
      loadPoints();

      if (data?.action === 'CHECK_IN') {
        setShowScanQR(false);
        setShowCheckInSuccess(true);
        return;
      }

      if (data?.action === 'CHECK_OUT') {
        setShowScanQR(false);
        try {
          const { data: history } = await assistanceApi.getMyAssistanceHistory();
          const todayStr = new Date().toDateString();
          // Backend/src/services/assistance.service.js#getAssistanceHistory
          // returns raw Assistance rows (no joined trainer name), for every
          // status — filter to COMPLETED + today client-side.
          const helpedToday = (history ?? []).filter(
            (a) =>
              a.status === 'COMPLETED' &&
              a.trainerId &&
              a.completedAt &&
              new Date(a.completedAt).toDateString() === todayStr
          );
          if (helpedToday.length > 0) {
            const uniqueTrainers = [];
            const seen = new Set();
            for (const a of helpedToday) {
              if (!seen.has(a.trainerId)) {
                seen.add(a.trainerId);
                // No trainer name available from this endpoint (data gap);
                // RateTrainerPopup falls back to showing the id.
                uniqueTrainers.push({ id: a.trainerId, name: a.trainerId });
              }
            }
            setRateTrainerSessionId(data.session?.id ?? null);
            setRateTrainerList(uniqueTrainers);
            setShowRateTrainer(true);
          }
        } catch {
          // If we can't tell whether they were helped, skip the pop-up
          // rather than block checkout on it.
        }
        return;
      }

      setScanFeedback({ type: 'success', message: data?.message || t('user.home.scanSuccess') });
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
      <Header
        pageTitle={t('user.home.title')}
        subtitle={t('user.home.subtitle')}
        onPressNotifications={onGoToNotifications}
        unreadCount={unreadCount}
      />

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
          <Button label={t('user.home.notifications')} onPress={onGoToNotifications} variant="secondary" />
          <Button label={t('user.home.logout')} onPress={onLogout} variant="danger" />
        </View>

        <Text style={styles.backLink} onPress={onBack}>{t('user.home.back')}</Text>
      </ScrollView>

      {/* Check-in success pop-up (spec section 3 QR logic). */}
      <Modal
        visible={showCheckInSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCheckInSuccess(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('user.home.checkInSuccessTitle')}</Text>
            <Text>{t('user.home.checkInSuccessBody')}</Text>
            <Button label={t('common.close')} onPress={() => setShowCheckInSuccess(false)} />
          </View>
        </View>
      </Modal>

      {showSocialInteraction && activeChallenge && (
        <Modal
          visible={showSocialInteraction}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSocialInteraction(false)}
        >
          <SocialInteractionPopup
            challenge={activeChallenge}
            currentUserId={user?.id}
            onDone={() => setShowSocialInteraction(false)}
            onClose={() => setShowSocialInteraction(false)}
          />
        </Modal>
      )}

      {showRateTrainer && (
        <Modal
          visible={showRateTrainer}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRateTrainer(false)}
        >
          <RateTrainerPopup
            sessionId={rateTrainerSessionId}
            trainers={rateTrainerList}
            onRated={() => setShowRateTrainer(false)}
            onClose={() => setShowRateTrainer(false)}
          />
        </Modal>
      )}

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
  },
  cardTitle: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
});
