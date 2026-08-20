import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import QRScanner from '../../components/common/QRScanner';
import BottomNav from '../../components/common/BottomNav';
import SocialInteractionPopup from './popups/SocialInteractionPopup';
import RateTrainerPopup from './popups/RateTrainerPopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import * as gamificationApi from '../../api/services/gamification.api';
import * as qrApi from '../../api/services/qr.api';
import * as assistanceApi from '../../api/services/assistance.api';
import * as challengeApi from '../../api/services/challenge.api';
import { flushQueue } from '../../offline/offlineQueue';

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
 * @param {function} [onGoToSettings] - opens Editar Perfil (the "..." button)
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
  onGoToWrapped,
  onGoToHome,
  onLogout,
}) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // "Cerrar sesión" — asks for confirmation before actually logging out,
  // same pattern used elsewhere in the app for destructive actions.
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
      {/* ---------------- HEADER (".Espacio") ---------------- */}
      <View style={styles.espacio}>
        <Text style={styles.h1}>{t('user.home.title')}</Text>
        <View style={styles.headerIcons}>
          {/* "..." -> Editar perfil (SettingsScreen). Al guardar ahí,
              la navegación vuelve a esta misma pantalla ("Tu perfil"). */}
          <TouchableOpacity onPress={onGoToSettings} style={styles.headerIconButton}>
            <Image source={require('../../assets/Group 29 (4).png')} style={styles.espacioImg} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- PROFILE HEADER (".centro") ---------------- */}
        <View style={styles.centro}>
          <View style={styles.eCirculoImagen}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.circuloImagenPhoto} />
            ) : (
              <View style={styles.circuloImagen}>
                <Text style={styles.circuloPuntos}>{initials || '🙂'}</Text>
              </View>
            )}
          </View>
          <View style={styles.resto}>
            <Text style={styles.h1RestoTitle}>{fullName.toUpperCase()}</Text>
            <Text style={styles.h1Mail}>{user?.email || ''}</Text>
            <TouchableOpacity style={styles.scanQrButtonInline} onPress={onGoToSettings}>
              <Text style={styles.scanQrButtonInlineLabel}>{t('user.home.member')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ---------------- STATS (".final" / ".D1") ---------------- */}
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

        {/* ---------------- SECTIONS (".E" / ".E1" ".E2" ".E3") ---------------- */}
        <View style={styles.e}>
          {/* Current plan — full-width card, like .E1 */}
          <TouchableOpacity style={styles.e1} onPress={onGoToRoutines}>
            <Text style={styles.t1}>{t('user.home.currentPlan')}</Text>
          </TouchableOpacity>

          {/* Personal data — two info items (profession, current goal),
              like the "Datos personales" card in the mockup. Tapping
              either one opens Editar Perfil, since that's where both are
              actually edited. */}
          <View style={styles.e2}>
            <Text style={styles.t2}>{t('user.home.personalData')}</Text>
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

          {/* Achievements — hexagon badge row, like .E3 */}
          <View style={styles.e2}>
            <Text style={styles.t2}>{t('user.home.achievements')}</Text>
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

          {/* Log out — like ".E3" (full-width danger card) */}
          <TouchableOpacity style={styles.e3} onPress={() => setShowLogoutConfirm(true)}>
            <Text style={styles.t3}>{t('user.home.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconButton: {
    position: 'relative',
  },
  espacioImg: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
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
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  eCirculoImagen: {
    // wraps the circle, mirrors ".ECirculoImagen"
  },
  circuloImagen: {
    width: 90,
    height: 90,
    backgroundColor: globals.colors.avatarPlaceholder,
    borderRadius: 45,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloImagenPhoto: {
    width: 90,
    height: 90,
    borderRadius: 45,
    flexShrink: 0,
  },
  circuloPuntos: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.text,
  },
  resto: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 12,
  },
  h1RestoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: globals.colors.text,
    textAlign: 'center',
  },
  h1Mail: {
    color: globals.colors.textMuted,
    fontSize: 13,
    marginBottom: 0,
    textAlign: 'center',
  },
  scanQrButtonInline: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.full,
    height: 28,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
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
  d1Number: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: 4,
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

  // ---------------- "Datos personales" info items ----------------
  datosRow: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 12,
  },
  datoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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

  // ---------------- hexágonos ----------------
  hexagonos: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 15,
    alignItems: 'center',
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
  hexagonoDanger: {
    backgroundColor: globals.colors.danger,
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
});
