import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import QRScanner from '../../components/common/QRScanner';
import BottomNav from '../../components/common/BottomNav';
import SocialInteractionPopup from '../../components/user/SocialInteractionPopup';
import RateTrainerPopup from '../../components/user/RateTrainerPopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import * as gamificationApi from '../../features/api/services/gamification.api';
import * as qrApi from '../../features/api/services/qr.api';
import * as assistanceApi from '../../features/api/services/assistance.api';
import * as challengeApi from '../../features/api/services/challenge.api';
import { flushQueue } from '../../features/offline/offlineQueue';

/**
 * User Profile screen ("Tu perfil") - reached by tapping the "usuario"
 * (person) icon in the bottom nav bar, present on most screens after
 * login. Shows the data configured previously in the mandatory first-time
 * Settings flow (name, photo, stats, current plan, achievements).
 *
 * IMPORTANT: this used to live inside HomeScreen.js / ROUTES.USER_HOME by
 * mistake — conceptually it's the "person" tab destination, not a "house"
 * dashboard (the app's bottom bar has a separate, still-unbuilt house
 * icon for that). It was moved into its own file/route (USER_PROFILE) so
 * the "person" icon and the "house" icon can point at two different
 * screens instead of being conflated into one.
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
 * hexagon shape is drawn with react-native-svg (see the Hexagon component
 * below) instead of the plain rounded-square approximation this screen
 * used to fall back to.
 *
 * The "..." button (top-right) opens Editar Perfil (SettingsScreen) —
 * matches the "Editar perfil" mockups. Saving there navigates back to
 * this exact screen (ROUTES.USER_PROFILE), not to a generic "home".
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
 * @param {function} [onGoToRoutines]
 * @param {function} [onGoToAchievementsGoals]
 * @param {function} [onGoToSettings] - opens Editar Perfil (first entry of the "..." menu)
 * @param {function} [onGoToHistory] - "..." menu entry
 * @param {function} [onGoToReports] - "..." menu entry
 * @param {function} [onGoToWrapped]
 * @param {function} [onGoToHome] - "house" footer icon; separate dashboard, not this screen
 * @param {function} [onLogout] - called after the "are you sure?" pop-up is confirmed
 */

// True hexagon badge (".hexagono" in Perfil.css uses clip-path: polygon()).
// RN has no clip-path, but react-native-svg (already a project dependency)
// lets us draw the exact same flat-top hexagon shape instead of the
// rounded-square approximation this screen used to fall back to.
const HEX_W = 45;
const HEX_H = 50;
const HEX_POINTS = [
  [HEX_W * 0.5, 0],
  [HEX_W, HEX_H * 0.25],
  [HEX_W, HEX_H * 0.75],
  [HEX_W * 0.5, HEX_H],
  [0, HEX_H * 0.75],
  [0, HEX_H * 0.25],
]
  .map(([x, y]) => `${x},${y}`)
  .join(' ');

function Hexagon({ color, onPress, children }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.hexagono} activeOpacity={0.75}>
      <Svg
        width={HEX_W}
        height={HEX_H}
        viewBox={`0 0 ${HEX_W} ${HEX_H}`}
        style={StyleSheet.absoluteFillObject}
      >
        <Polygon points={HEX_POINTS} fill={color} />
      </Svg>
      <View style={styles.hexagonoContent}>{children}</View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen({
  onGoToRoutines,
  onGoToAchievementsGoals,
  onGoToSettings,
  onGoToHistory,
  onGoToReports,
  onGoToWrapped,
  onGoToHome,
  onLogout,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // "Cerrar sesión" — asks for confirmation before actually logging out,
  // same pattern used elsewhere in the app for destructive actions.
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // "..." menu (top-right): Edit profile, History, Reports, Year Wrapped,
  // Log out. History / Reports / Wrapped / Log out used to live on the Home
  // screen and the red card at the bottom of this one; the new design has
  // no slot for them, so they live here.
  const [showMenu, setShowMenu] = useState(false);
  const goFromMenu = (handler) => () => {
    setShowMenu(false);
    handler && handler();
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout && onLogout();
  };

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
      loadActiveChallenge();
      // Best-effort silent retry of anything queued while offline.
      flushQueue();
    }, [loadPoints, loadActiveChallenge])
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

  const initials = `${(user?.firstName || '').charAt(0)}${(user?.lastName || '').charAt(0)}`.toUpperCase();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || t('user.home.title');
  const mainGoalLabel = Array.isArray(user?.objectives) ? user.objectives[0] : null;

  return (
    <View style={styles.body}>
      {/* ---------------- HEADER: centered title + "..." menu ---------------- */}
      <View style={styles.espacio}>
        <View style={styles.headerSide} />
        <Text style={styles.h1}>{t('user.home.title')}</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={styles.headerIconButton} hitSlop={10}>
            <Image source={require('../../assets/Group 29 (4).png')} style={styles.espacioImg} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- PROFILE HEADER: photo left, data right ---------------- */}
        <View style={styles.centro}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.circuloImagenPhoto} />
          ) : (
            <View style={styles.circuloImagen}>
              <Text style={styles.circuloPuntos}>{initials || '🙂'}</Text>
            </View>
          )}
          <View style={styles.resto}>
            <Text style={styles.h1RestoTitle} numberOfLines={2}>{fullName}</Text>
            <Text style={styles.h1Mail} numberOfLines={1}>{user?.email || ''}</Text>
            <TouchableOpacity style={styles.levelBadge} onPress={onGoToSettings}>
              <Text style={styles.levelBadgeLabel}>{t('user.home.member')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ---------------- STATS ---------------- */}
        <View style={styles.final}>
          <View style={styles.d1}>
            <Text style={styles.d1Number}>{pointsLoading ? '…' : '28'}</Text>
            <Text style={styles.texto}>{t('user.home.trainingsCompleted')}</Text>
          </View>
          <View style={styles.d1}>
            <Text style={styles.d1Number}>14</Text>
            <Text style={styles.texto}>{t('user.home.currentStreak')}</Text>
          </View>
          <View style={styles.d1}>
            <Text style={styles.d1Number}>6</Text>
            <Text style={styles.texto}>{t('user.home.achievementsObtained')}</Text>
          </View>
          <View style={styles.d1}>
            <Text style={styles.d1Number}>
              {pointsLoading ? '…' : points.toLocaleString()}
            </Text>
            <Text style={styles.texto}>{t('user.home.totalPoints')}</Text>
          </View>
        </View>

        {/* ---------------- CARDS ---------------- */}
        <View style={styles.e}>
          {/* Current plan */}
          <TouchableOpacity style={[styles.cardBox, styles.planCard]} onPress={onGoToRoutines} activeOpacity={0.85}>
            <Text style={styles.t1}>{t('user.home.currentPlan')}</Text>
          </TouchableOpacity>

          {/* Personal data — profession | current goal. Tapping either one
              opens Editar Perfil, since that's where both are edited. */}
          <View style={styles.cardBox}>
            <Text style={styles.t1}>{t('user.home.personalData')}</Text>
            <View style={styles.datosRow}>
              <TouchableOpacity style={styles.datoItem} onPress={onGoToSettings}>
                <View style={[styles.datoIconWrap, styles.datoIconWrapProfesion]}>
                  <Text style={styles.datoIcon}>💼</Text>
                </View>
                <View style={styles.datoTextWrap}>
                  <Text style={styles.datoLabel} numberOfLines={1}>
                    {t('user.home.profession')}
                  </Text>
                  <Text style={styles.datoValue} numberOfLines={1}>
                    {user?.profession || t('user.home.notSpecified')}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.datoDivider} />
              <TouchableOpacity style={styles.datoItem} onPress={onGoToSettings}>
                <View style={[styles.datoIconWrap, styles.datoIconWrapObjetivo]}>
                  <Text style={styles.datoIcon}>🎯</Text>
                </View>
                <View style={styles.datoTextWrap}>
                  <Text style={styles.datoValue} numberOfLines={1}>
                    {mainGoalLabel || t('user.home.notSpecified')}
                  </Text>
                  <Text style={styles.datoLabel} numberOfLines={1}>
                    {t('user.home.currentGoal')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Achievements — hexagon badge row */}
          <View style={styles.cardBox}>
            <Text style={styles.t1}>{t('user.home.achievements')}</Text>
            <View style={styles.hexagonos}>
              <Hexagon color={styles.hexagonoGreen.backgroundColor} onPress={onGoToAchievementsGoals}>
                <Text style={styles.hexagonoIcon}>🥇</Text>
              </Hexagon>
              <Hexagon color={styles.hexagonoTeal.backgroundColor} onPress={onGoToAchievementsGoals}>
                <Text style={styles.hexagonoIcon}>💪</Text>
              </Hexagon>
              <Hexagon color={styles.hexagonoMaroon.backgroundColor} onPress={onGoToAchievementsGoals}>
                <Text style={styles.hexagonoIcon}>📅</Text>
              </Hexagon>
              <Hexagon color={styles.hexagonoOrange.backgroundColor} onPress={onGoToAchievementsGoals}>
                <Text style={styles.hexagonoIcon}>👑</Text>
              </Hexagon>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* "..." menu pop-over. */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={goFromMenu(onGoToSettings)}>
              <Text style={styles.menuItemText}>{t('user.home.settings')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={goFromMenu(onGoToHistory)}>
              <Text style={styles.menuItemText}>{t('user.home.history')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={goFromMenu(onGoToReports)}>
              <Text style={styles.menuItemText}>{t('user.home.reports')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={goFromMenu(onGoToWrapped)}>
              <Text style={styles.menuItemText}>{t('user.home.wrapped')}</Text>
            </TouchableOpacity>
            <View style={styles.menuSeparator} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                setShowLogoutConfirm(true);
              }}
            >
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>{t('user.home.logout')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Log out confirmation pop-up. */}
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
                <Text style={styles.modalButtonSecondaryLabel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonDanger]} onPress={confirmLogout}>
                <Text style={styles.modalButtonLabel}>{t('user.home.logout')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ---------------- FOOTER ----------------
          Shared component: same 5 buttons -> same 5 destinations on every
          screen that has it. This IS the "profile" destination, so that
          tab is passed as `active` instead of a handler. */}
      <BottomNav
        active="profile"
        onGoToHome={onGoToHome}
        onGoToCalendar={onGoToRoutines}
        onScanQR={() => setShowScanQR(true)}
        onGoToAchievements={onGoToAchievementsGoals}
      />

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

  // ---------------- HEADER ----------------
  espacio: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerSide: {
    width: 40,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  h1: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: globals.colors.text,
  },
  headerIconButton: {
    padding: 4,
  },
  espacioImg: {
    width: 24,
    height: 6,
    resizeMode: 'contain',
  },

  // ---------------- scroll wrapper ----------------
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: globals.spacing.lg,
  },

  // ---------------- PROFILE HEADER ----------------
  centro: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 14,
    paddingHorizontal: 20,
    gap: 18,
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
  circuloImagenPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    flexShrink: 0,
  },
  circuloPuntos: {
    fontSize: 32,
    fontWeight: 'bold',
    color: globals.colors.text,
  },
  resto: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  h1RestoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    color: globals.colors.text,
  },
  h1Mail: {
    color: globals.colors.textSecondary,
    fontSize: 11,
  },
  levelBadge: {
    backgroundColor: globals.colors.tealSoft,
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 12,
  },
  levelBadgeLabel: {
    color: globals.colors.text,
    fontWeight: '600',
    fontSize: 10,
  },

  // ---------------- STATS ----------------
  final: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    width: '100%',
    marginTop: 34,
    paddingHorizontal: 12,
  },
  d1: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '25%',
  },
  d1Number: {
    fontSize: 17,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: 4,
  },
  texto: {
    fontSize: 10,
    color: globals.colors.textSecondary,
    textAlign: 'center',
  },

  // ---------------- CARDS ----------------
  e: {
    flexDirection: 'column',
    gap: 14,
    width: '100%',
    marginTop: 26,
    paddingHorizontal: 18,
  },
  cardBox: {
    backgroundColor: globals.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    paddingVertical: 14,
    paddingHorizontal: 14,
    ...globals.shadow.card,
  },
  planCard: {
    minHeight: 130,
  },
  t1: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
    color: globals.colors.text,
  },

  // ---------------- "Datos personales" ----------------
  datosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  datoDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 10,
    backgroundColor: globals.colors.surfaceBorder,
  },

  // ---------------- hexágonos ----------------
  hexagonos: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 4,
  },

  // ---------------- "..." menu ----------------
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 16,
  },
  menuCard: {
    minWidth: 220,
    backgroundColor: globals.colors.surface,
    borderRadius: 12,
    paddingVertical: 6,
    ...globals.shadow.card,
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 14,
    color: globals.colors.text,
  },
  menuItemDanger: {
    color: globals.colors.danger,
    fontWeight: '600',
  },
  menuSeparator: {
    height: 1,
    marginVertical: 4,
    backgroundColor: globals.colors.surfaceBorder,
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
  hexagono: {
    // True hexagon (clip-path: polygon() in Perfil.css), drawn with an
    // <Svg><Polygon/></Svg> underlay by the Hexagon component above —
    // this just reserves the footprint and stacks the icon on top.
    width: HEX_W,
    height: HEX_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexagonoContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexagonoGreen: {
    backgroundColor: '#4CAF50',
  },
  hexagonoTeal: {
    backgroundColor: '#177E89',
  },
  hexagonoMaroon: {
    backgroundColor: '#6B3F4D',
  },
  hexagonoOrange: {
    backgroundColor: '#F2994A',
  },
  hexagonoIcon: {
    fontSize: 18,
  },
  datoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: globals.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  datoIconWrapProfesion: {
    backgroundColor: '#DCEEF2',
  },
  datoIconWrapObjetivo: {
    backgroundColor: '#FBE7D4',
  },
  datoIcon: {
    fontSize: 16,
  },
  datoTextWrap: {
    flexShrink: 1,
  },
  datoLabel: {
    fontSize: 11,
    color: globals.colors.textMuted,
  },
  datoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: globals.colors.text,
  },
  datoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
