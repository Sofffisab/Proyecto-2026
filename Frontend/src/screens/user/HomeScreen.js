import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
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
 * Main Screen (User) - spec section 3 / 8 ("UserHome").
 *
 * Visual design ported from src/pantallashtml/Perfil.html + Perfil.css
 * (web) into React Native, following the project's HTML -> RN conversion
 * steps:
 *   1) div/section -> View, free text -> Text, button/a -> TouchableOpacity.
 *   2) onClick -> onPress.
 *   3) CSS -> StyleSheet.create at the bottom, camelCase, unitless numbers.
 *   4) Typography (color/size/weight) moved onto the Text elements.
 *   5) Default flexDirection is 'column' in RN, so every CSS `display:flex`
 *      row (".Espacio", ".centro", ".final", ".hexagonos", ".footer") gets
 *      an explicit `flexDirection: 'row'`.
 *   6) Text doesn't carry browser default margins, so marginBottom/Top was
 *      added by hand to match the HTML spacing.
 * All colors/spacing/radius/fontSize come from src/styles/globals.js
 * (design tokens), which already match Perfil.css 1:1 (primary #177E89,
 * avatarPlaceholder grey circle, sectionCard grey blocks, etc).
 *
 * NOTE: CSS `clip-path` (used for `.hexagono`) has no RN equivalent, so the
 * hexagon shape is approximated with a rounded square of the same size.
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
 * @param {function} [onLogout] - called after the "are you sure?" pop-up is confirmed
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

  // "Are you sure?" pop-up for the log out / switch account button.
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout && onLogout();
  };

  return (
    <View style={styles.body}>
      {/* ---------------- HEADER (".Espacio") ---------------- */}
      <View style={styles.espacio}>
        <Text style={styles.h1}>{t('user.home.title')}</Text>
        <TouchableOpacity onPress={onGoToNotifications} style={styles.headerIconButton}>
          <Image source={require('../../assets/Group 29 (4).png')} style={styles.espacioImg} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- POINTS (".centro") ---------------- */}
        <View style={styles.centro}>
          <View style={styles.eCirculoImagen}>
            <View style={styles.circuloImagen}>
              <Text style={styles.circuloPuntos}>
                {pointsLoading ? '…' : String(points)}
              </Text>
            </View>
          </View>
          <View style={styles.resto}>
            <Text style={styles.h1RestoTitle}>{t('user.home.pointsAccumulated')}</Text>
            <Text style={styles.h1Mail}>
              {pointsLoading ? t('user.home.pointsLoading') : t('user.home.subtitle')}
            </Text>
            <TouchableOpacity style={styles.scanQrButtonInline} onPress={() => setShowScanQR(true)}>
              <Text style={styles.scanQrButtonInlineLabel}>{t('user.home.scanQR')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ---------------- QUICK NAV (".final" / ".D1") ---------------- */}
        <View style={styles.final}>
          <TouchableOpacity style={styles.d1} onPress={onGoToHistory}>
            <Text style={styles.d1Icon}>🕘</Text>
            <Text style={styles.texto}>{t('user.home.history')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.d1} onPress={onGoToRoutines}>
            <Text style={styles.d1Icon}>📋</Text>
            <Text style={styles.texto}>{t('user.home.routines')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.d1} onPress={onGoToAchievementsGoals}>
            <Text style={styles.d1Icon}>🏆</Text>
            <Text style={styles.texto}>{t('user.home.achievementsGoals')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.d1} onPress={onGoToReports}>
            <Text style={styles.d1Icon}>📊</Text>
            <Text style={styles.texto}>{t('user.home.reports')}</Text>
          </TouchableOpacity>
        </View>

        {/* ---------------- SECTIONS (".E" / ".E1" ".E2" ".E3") ---------------- */}
        <View style={styles.e}>
          {/* Ask for Help — full-width bar, like .E1 */}
          <TouchableOpacity
            style={styles.e1}
            onPress={handleAskForHelp}
            disabled={helpLoading}
          >
            <Text style={styles.t1}>
              {helpLoading ? t('user.home.pedirAyudaLoading') : t('user.home.pedirAyuda')}
            </Text>
          </TouchableOpacity>
          {helpFeedback && (
            <Text style={helpFeedback.type === 'error' ? styles.errorText : styles.successText}>
              {helpFeedback.message}
            </Text>
          )}

          {/* Settings / Wrapped / Logout — hexagon-style icon row, like .E2 */}
          <View style={styles.e2}>
            <Text style={styles.t2}>{t('user.home.settings')}</Text>
            <View style={styles.hexagonos}>
              <TouchableOpacity style={styles.hexagono} onPress={onGoToSettings}>
                <Text style={styles.hexagonoIcon}>⚙️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.hexagono} onPress={onGoToWrapped}>
                <Text style={styles.hexagonoIcon}>🎁</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.hexagono} onPress={onGoToNotifications}>
                <Text style={styles.hexagonoIcon}>🔔</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hexagono, styles.hexagonoDanger]}
                onPress={() => setShowLogoutConfirm(true)}
              >
                <Text style={styles.hexagonoIcon}>🚪</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Logout — full-width danger bar, like .E3 */}
          <TouchableOpacity style={styles.e3} onPress={() => setShowLogoutConfirm(true)}>
            <Text style={styles.t3}>{t('user.home.logout')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.backLink} onPress={onBack}>{t('user.home.back')}</Text>
      </ScrollView>

      {/* ---------------- FOOTER (".footer") ---------------- */}
      <View style={styles.footer}>
        <Image source={require('../../assets/Imagen.png')} style={styles.footerImg} />
        <Image source={require('../../assets/Vector (3).png')} style={styles.footerImg} />
        <TouchableOpacity style={styles.circulo} onPress={() => setShowScanQR(true)}>
          <Image source={require('../../assets/boxicons_qr-scan.png')} style={styles.qr} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onGoToAchievementsGoals}>
          <Image source={require('../../assets/proicons_trophy.png')} style={styles.footerImg} />
        </TouchableOpacity>
        <Image source={require('../../assets/Group 49.png')} style={styles.footerImg} />
      </View>

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
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowCheckInSuccess(false)}>
              <Text style={styles.modalButtonLabel}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Log out / switch account confirmation pop-up ("¿estás seguro?"). */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('user.home.logoutConfirmTitle')}</Text>
            <Text>{t('user.home.logoutConfirmMessage')}</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.modalButtonSecondaryLabel}>{t('common.no')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonDanger]} onPress={confirmLogout}>
                <Text style={styles.modalButtonLabel}>{t('common.yes')}</Text>
              </TouchableOpacity>
            </View>
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
                  <TouchableOpacity style={styles.modalButton} onPress={closeScanQR}>
                    <Text style={styles.modalButtonLabel}>{t('common.close')}</Text>
                  </TouchableOpacity>
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
  // ---------------- body ----------------
  body: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },

  // ---------------- HEADER (".Espacio") ----------------
  espacio: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  h1: {
    fontSize: 22,
    fontWeight: 'bold',
    color: globals.colors.text,
  },
  headerIconButton: {
    position: 'relative',
  },
  espacioImg: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: globals.colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // ---------------- scroll wrapper ----------------
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: globals.spacing.lg,
  },

  // ---------------- POINTS (".centro") ----------------
  centro: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 35,
    width: '100%',
    marginTop: 20,
  },
  eCirculoImagen: {
    // wraps the circle, mirrors ".ECirculoImagen"
  },
  circuloImagen: {
    width: 120,
    height: 120,
    backgroundColor: globals.colors.avatarPlaceholder,
    borderRadius: 60,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloPuntos: {
    fontSize: globals.fontSize.xxl,
    fontWeight: 'bold',
    color: globals.colors.text,
  },
  resto: {
    flexDirection: 'column',
  },
  h1RestoTitle: {
    fontSize: 20,
    marginBottom: 8,
    color: globals.colors.text,
  },
  h1Mail: {
    color: globals.colors.textMuted,
    fontSize: 13,
    marginBottom: 0,
  },
  scanQrButtonInline: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.full,
    height: 30,
    paddingHorizontal: 14,
    marginTop: 15,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  scanQrButtonInlineLabel: {
    color: globals.colors.secondary,
    fontWeight: '600',
    fontSize: globals.fontSize.sm,
  },

  // ---------------- QUICK NAV (".final" / ".D1") ----------------
  final: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    width: '100%',
    marginTop: 35,
    paddingHorizontal: 10,
    gap: 5,
  },
  d1: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '25%',
  },
  d1Icon: {
    fontSize: 20,
    marginBottom: 5,
  },
  texto: {
    fontSize: 10,
    color: globals.colors.textMuted,
    textAlign: 'center',
  },

  // ---------------- SECTIONS (".E" / ".E1" ".E2" ".E3") ----------------
  e: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    marginTop: 30,
    paddingHorizontal: globals.spacing.md,
    paddingBottom: 110,
  },
  e1: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 100,
    width: '100%',
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
  },
  e2: {
    flexDirection: 'column',
    height: 100,
    width: '100%',
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    justifyContent: 'center',
  },
  e3: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    width: '100%',
    backgroundColor: globals.colors.danger,
    borderRadius: globals.radius.md,
  },
  t1: {
    fontSize: 14,
    margin: 10,
    color: globals.colors.text,
  },
  t2: {
    fontSize: 14,
    margin: 10,
    color: globals.colors.text,
  },
  t3: {
    fontSize: 14,
    fontWeight: '600',
    color: globals.colors.secondary,
  },

  // ---------------- hexágonos ----------------
  hexagonos: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 15,
    alignItems: 'center',
  },
  hexagono: {
    // clip-path polygon() has no RN equivalent — approximated with a
    // rounded square of the same footprint as ".hexagono" (45x50).
    width: 45,
    height: 50,
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexagonoDanger: {
    backgroundColor: globals.colors.danger,
  },
  hexagonoIcon: {
    fontSize: 18,
  },

  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginTop: globals.spacing.xs,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },
  successText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    marginTop: globals.spacing.xs,
    marginBottom: globals.spacing.sm,
    textAlign: 'center',
  },

  // ---------------- QR scanner modal ----------------
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

  // ---------------- generic confirm/success modal ----------------
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
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: globals.spacing.sm,
    marginTop: globals.spacing.md,
  },
  modalButton: {
    backgroundColor: globals.colors.primary,
    paddingVertical: globals.spacing.sm,
    paddingHorizontal: globals.spacing.lg,
    borderRadius: globals.radius.md,
    alignItems: 'center',
    marginTop: globals.spacing.md,
  },
  modalButtonLabel: {
    color: globals.colors.secondary,
    fontWeight: '600',
  },
  modalButtonSecondary: {
    backgroundColor: globals.colors.secondary,
    borderWidth: 1,
    borderColor: globals.colors.border,
  },
  modalButtonSecondaryLabel: {
    color: globals.colors.text,
    fontWeight: '600',
  },
  modalButtonDanger: {
    backgroundColor: globals.colors.danger,
  },

  // ---------------- FOOTER (".footer") ----------------
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    height: 75,
    backgroundColor: globals.colors.badge,
  },
  footerImg: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  circulo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 60,
    width: 60,
    backgroundColor: globals.colors.primary,
    borderRadius: 30,
  },
  qr: {
    width: 35,
    height: 35,
  },
});
