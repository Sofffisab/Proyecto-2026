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
import * as notificationApi from '../../api/services/notification.api';
import * as challengeApi from '../../api/services/challenge.api';
import * as routineApi from '../../api/services/routine.api';
import * as historyApi from '../../api/services/history.api';
import { flushQueue } from '../../offline/offlineQueue';

// Mon..Sun short labels for the week row (".hexagonos"-style row of dots
// in the new Home design). Hardcoded like the rest of this screen's icon
// glyphs (🕘📊🆘🚪 below) rather than translated, since they're single
// letters tied to a fixed visual slot, not sentences.
const WEEK_DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// JS's Date#getDay() is Sun=0..Sat=6; the design's week row is Mon..Sun.
function mondayFirstIndex(jsDay) {
  return (jsDay + 6) % 7;
}

function toDateKey(date) {
  return date.toISOString().split('T')[0];
}

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

export default function HomeScreen({
  onGoToHistory,
  onGoToRoutines,
  onGoToAchievementsGoals,
  onGoToReports,
  onGoToSettings,
  onGoToWrapped,
  onGoToNotifications,
  onGoToProfile,
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

  // GET /routines/today — powers the "HOY" hero card and the "PRÓXIMO
  // ENTRENAMIENTO" card. `content` is free-form JSON (Routine model has no
  // fixed exercise-count/duration/day-of-week fields), so those bits fall
  // back to sensible placeholders when a routine doesn't specify them —
  // same "data gap" pattern already used elsewhere on this screen (e.g.
  // the rateTrainer trainer-name fallback above).
  const [todayRoutine, setTodayRoutine] = useState(null);
  const [nextRoutine, setNextRoutine] = useState(null);
  const [routinesLoading, setRoutinesLoading] = useState(true);

  // GET /history/machine-usage — grouped by day; used to mark which days
  // of *this* week the user actually trained, for the week row of dots
  // and the "X de Y entrenamientos completados" progress card. There's no
  // dedicated "weekly schedule" endpoint, so this is the closest real
  // signal available or the trick counts as invented data.
  const [weekActivity, setWeekActivity] = useState({}); // { 'YYYY-MM-DD': true }

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

  const loadTodayRoutines = useCallback(async () => {
    try {
      setRoutinesLoading(true);
      const { data } = await routineApi.getTodayOptions();
      const saved = data?.routines ?? [];
      // Prefer the user's own saved/AI-accepted routines; fall back to the
      // always-available free routine so the hero card is never empty.
      const first = saved[0] ?? (data?.freeRoutine ?? null);
      const second = saved[1] ?? (saved[0] ? data?.freeRoutine : null);
      setTodayRoutine(first);
      setNextRoutine(second ?? null);
    } catch {
      // Best-effort — the hero card just falls back to its empty state.
    } finally {
      setRoutinesLoading(false);
    }
  }, []);

  const loadWeekActivity = useCallback(async () => {
    try {
      const { data } = await historyApi.getDailyMachineUsageLog();
      const grouped = data ?? {};
      const today = new Date();
      const mondayOffset = mondayFirstIndex(today.getDay());
      const monday = new Date(today);
      monday.setDate(today.getDate() - mondayOffset);

      const activity = {};
      for (let i = 0; i < 7; i += 1) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        const key = toDateKey(day);
        activity[key] = Boolean(grouped[key] && grouped[key].length > 0);
      }
      setWeekActivity(activity);
    } catch {
      // Silent — the week row just shows no checkmarks this time.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPoints();
      loadUnreadCount();
      loadActiveChallenge();
      loadTodayRoutines();
      loadWeekActivity();
      // Best-effort silent retry of anything queued while offline.
      flushQueue();
    }, [loadPoints, loadUnreadCount, loadActiveChallenge, loadTodayRoutines, loadWeekActivity])
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

  const initials = `${(user?.firstName || '').charAt(0)}${(user?.lastName || '').charAt(0)}`.toUpperCase();

  // Week-row + progress-card numbers, derived from loadWeekActivity's
  // real (if sparse) machine-usage-by-day signal.
  const weekDoneCount = Object.values(weekActivity).filter(Boolean).length;
  const weekKeys = Object.keys(weekActivity).sort();
  const todayIndex = mondayFirstIndex(new Date().getDay());
  const todayKey = toDateKey(new Date());

  const todayDayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' });
  const nextDayLabel = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' });
  })();

  const routineExerciseCount = (routine) => {
    const exercises = routine?.content?.exercises;
    return Array.isArray(exercises) ? exercises.length : null;
  };
  const routineDuration = (routine) => routine?.content?.durationMinutes ?? null;

  return (
    <View style={styles.body}>
      {/* ---------------- HEADER (".Espacio") ---------------- */}
      <View style={styles.espacio}>
        <View style={styles.espacioGreeting}>
          <Text style={styles.h1}>{t('user.home.greeting', { name: user?.firstName || t('user.home.member') })}</Text>
          <Text style={styles.espacioSubtitle}>{t('user.home.greetingSubtitle')}</Text>
        </View>
        <View style={styles.espacioActions}>
          <TouchableOpacity onPress={onGoToNotifications} style={styles.headerIconButton}>
            <Image source={require('../../assets/Group 29 (4).png')} style={styles.espacioImg} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onGoToProfile}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.headerAvatarPhoto} />
            ) : (
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>{initials || '🙂'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- TODAY HERO CARD ---------------- */}
        <TouchableOpacity style={styles.heroCard} onPress={onGoToRoutines} activeOpacity={0.9}>
          <View style={styles.heroTextCol}>
            <Text style={styles.heroLabel}>
              {t('user.home.todayLabel')} • {todayDayLabel}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {routinesLoading
                ? '…'
                : todayRoutine?.name || t('user.home.noRoutineTitle')}
            </Text>
            <Text style={styles.heroMeta}>
              {routinesLoading
                ? ' '
                : [
                    routineExerciseCount(todayRoutine) != null
                      ? t('user.home.exercisesCount', { count: routineExerciseCount(todayRoutine) })
                      : null,
                    routineDuration(todayRoutine) != null
                      ? t('user.home.durationMinutes', { count: routineDuration(todayRoutine) })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
            </Text>
            <View style={styles.heroButton}>
              <Text style={styles.heroButtonLabel}>{t('user.home.startTraining')} →</Text>
            </View>
          </View>
          <View style={styles.heroImageWrap}>
            <Text style={styles.heroImageEmoji}>💪</Text>
          </View>
        </TouchableOpacity>

        {/* ---------------- NEXT TRAINING ---------------- */}
        <Text style={styles.sectionLabel}>{t('user.home.nextTrainingLabel')}</Text>
        <TouchableOpacity style={styles.nextCard} onPress={onGoToRoutines}>
          <View style={styles.nextCardIcon}>
            <Text style={styles.nextCardIconText}>📅</Text>
          </View>
          <View style={styles.nextCardTextCol}>
            <Text style={styles.nextCardDay}>{nextDayLabel}</Text>
            <Text style={styles.nextCardTitle}>
              {routinesLoading
                ? '…'
                : nextRoutine?.name || t('user.home.noRoutineTitle')}
            </Text>
            {routineExerciseCount(nextRoutine) != null && (
              <Text style={styles.nextCardMeta}>
                {t('user.home.exercisesCount', { count: routineExerciseCount(nextRoutine) })}
              </Text>
            )}
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <Text style={styles.viewScheduleLink} onPress={onGoToRoutines}>
          {t('user.home.viewFullSchedule')} ›
        </Text>

        {/* ---------------- WEEK ROW ---------------- */}
        <View style={styles.weekRow}>
          {WEEK_DAY_LETTERS.map((letter, i) => {
            const key = weekKeys[i];
            const done = key ? Boolean(weekActivity[key]) : false;
            const isToday = i === todayIndex;
            return (
              <View key={`${letter}-${i}`} style={styles.weekDayCol}>
                <Text style={styles.weekDayLetter}>{letter}</Text>
                <View
                  style={[
                    styles.weekDot,
                    done && styles.weekDotDone,
                    isToday && !done && styles.weekDotToday,
                  ]}
                >
                  {done && <Text style={styles.weekDotCheck}>✓</Text>}
                </View>
              </View>
            );
          })}
        </View>

        {/* ---------------- PROGRESS CARD ---------------- */}
        <View style={styles.progressCard}>
          <View style={styles.progressIcon}>
            <Text style={styles.progressIconText}>📈</Text>
          </View>
          <View style={styles.progressTextCol}>
            <Text style={styles.progressTitle}>
              {t('user.home.trainingsCompletedThisWeek', { done: weekDoneCount, total: WEEK_DAY_LETTERS.length })}
            </Text>
            <Text style={styles.progressSubtitle}>{t('user.home.keepGoing')}</Text>
          </View>
          <View style={styles.progressPointsPill}>
            <Text style={styles.progressPointsText}>
              {pointsLoading ? '…' : points.toLocaleString()} {t('user.home.pointsShort')}
            </Text>
          </View>
        </View>

        {/* ---------------- MOTIVATIONAL QUOTE BANNER ---------------- */}
        <TouchableOpacity style={styles.quoteBanner} onPress={onGoToAchievementsGoals}>
          <Text style={styles.quoteIcon}>🏆</Text>
          <Text style={styles.quoteText}>{t('user.home.motivationalQuote')}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {/* ---------------- QUICK ACCESS (components from the previous
            design that aren't represented above: settings, wrapped,
            achievement badges, history, reports, ask for help, logout) --- */}
        <View style={styles.e}>
          <Text style={styles.sectionLabel}>{t('user.home.quickAccess')}</Text>

          <View style={styles.e2}>
            <Text style={styles.t2}>{t('user.home.personalData')}</Text>
            <View style={styles.hexagonos}>
              <Hexagon color={globals.colors.primary} onPress={onGoToSettings}>
                <Text style={styles.hexagonoIcon}>⚙️</Text>
              </Hexagon>
              <Hexagon color={globals.colors.danger} onPress={onGoToWrapped}>
                <Text style={styles.hexagonoIcon}>🎁</Text>
              </Hexagon>
            </View>
          </View>

          <View style={styles.e2}>
            <Text style={styles.t2}>{t('user.home.achievements')}</Text>
            <View style={styles.hexagonos}>
              <Hexagon color={styles.hexagonoGreen.backgroundColor} onPress={onGoToAchievementsGoals}>
                <Text style={styles.hexagonoIcon}>🥇</Text>
              </Hexagon>
              <Hexagon color={styles.hexagonoTeal.backgroundColor} onPress={onGoToAchievementsGoals}>
                <Text style={styles.hexagonoIcon}>💪</Text>
              </Hexagon>
              <Hexagon color={styles.hexagonoNavy.backgroundColor} onPress={onGoToAchievementsGoals}>
                <Text style={styles.hexagonoIcon}>🔥</Text>
              </Hexagon>
              <Hexagon color={styles.hexagonoOrange.backgroundColor} onPress={onGoToAchievementsGoals}>
                <Text style={styles.hexagonoIcon}>👑</Text>
              </Hexagon>
            </View>
          </View>

          <View style={styles.quickNavRow}>
            <TouchableOpacity style={styles.quickNavItem} onPress={onGoToHistory}>
              <Text style={styles.d1Icon}>🕘</Text>
              <Text style={styles.texto}>{t('user.home.history')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickNavItem} onPress={onGoToReports}>
              <Text style={styles.d1Icon}>📊</Text>
              <Text style={styles.texto}>{t('user.home.reports')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickNavItem} onPress={handleAskForHelp} disabled={helpLoading}>
              <Text style={styles.d1Icon}>🆘</Text>
              <Text style={styles.texto}>
                {helpLoading ? t('user.home.pedirAyudaLoading') : t('user.home.pedirAyuda')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickNavItem} onPress={() => setShowLogoutConfirm(true)}>
              <Text style={styles.d1Icon}>🚪</Text>
              <Text style={styles.texto}>{t('user.home.logout')}</Text>
            </TouchableOpacity>
          </View>
          {helpFeedback && (
            <Text style={helpFeedback.type === 'error' ? styles.errorText : styles.successText}>
              {helpFeedback.message}
            </Text>
          )}
        </View>

        <Text style={styles.backLink} onPress={onBack}>{t('user.home.back')}</Text>
      </ScrollView>

      {/* ---------------- FOOTER ----------------
          Shared component: same 5 buttons -> same 5 destinations on every
          screen that has it. This IS the "home" destination, so that tab
          is passed as `active` instead of a handler. */}
      <BottomNav
        active="home"
        onGoToCalendar={onGoToRoutines}
        onScanQR={() => setShowScanQR(true)}
        onGoToAchievements={onGoToAchievementsGoals}
        onGoToProfile={onGoToProfile}
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
    alignItems: 'flex-start',
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  espacioGreeting: {
    flexShrink: 1,
    paddingRight: 10,
  },
  h1: {
    fontSize: 22,
    fontWeight: 'bold',
    color: globals.colors.text,
  },
  espacioSubtitle: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: 4,
  },
  espacioActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconButton: {
    position: 'relative',
  },
  espacioImg: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: globals.colors.avatarPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarPhoto: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerAvatarText: {
    fontSize: globals.fontSize.sm,
    fontWeight: 'bold',
    color: globals.colors.text,
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

  // ---------------- TODAY HERO CARD ----------------
  heroCard: {
    flexDirection: 'row',
    backgroundColor: globals.colors.background,
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.lg,
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.md,
    overflow: 'hidden',
  },
  heroTextCol: {
    flex: 1,
    padding: globals.spacing.md,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: globals.colors.primary,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: 6,
  },
  heroMeta: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginBottom: globals.spacing.md,
  },
  heroButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  heroButtonLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: globals.fontSize.sm,
  },
  heroImageWrap: {
    width: 110,
    backgroundColor: globals.colors.sectionCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImageEmoji: {
    fontSize: 40,
  },

  // ---------------- NEXT TRAINING ----------------
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: globals.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
    marginBottom: globals.spacing.sm,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    marginHorizontal: globals.spacing.md,
    padding: globals.spacing.md,
    gap: globals.spacing.sm,
  },
  nextCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: globals.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCardIconText: {
    fontSize: 18,
  },
  nextCardTextCol: {
    flex: 1,
  },
  nextCardDay: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  nextCardTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
  },
  nextCardMeta: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: globals.colors.textMuted,
  },
  viewScheduleLink: {
    color: globals.colors.primary,
    fontWeight: '600',
    fontSize: globals.fontSize.sm,
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.sm,
  },

  // ---------------- WEEK ROW ----------------
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
  },
  weekDayCol: {
    alignItems: 'center',
    gap: 8,
  },
  weekDayLetter: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    fontWeight: '600',
  },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: globals.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotDone: {
    backgroundColor: globals.colors.primary,
    borderColor: globals.colors.primary,
  },
  weekDotToday: {
    borderColor: globals.colors.primary,
    borderWidth: 2,
  },
  weekDotCheck: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // ---------------- PROGRESS CARD ----------------
  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
    padding: globals.spacing.md,
    gap: globals.spacing.sm,
  },
  progressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: globals.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressIconText: {
    fontSize: 18,
  },
  progressTextCol: {
    flex: 1,
  },
  progressTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
  },
  progressSubtitle: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: 2,
  },
  progressPointsPill: {
    backgroundColor: globals.colors.background,
    borderRadius: globals.radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  progressPointsText: {
    fontSize: globals.fontSize.sm,
    fontWeight: '700',
    color: globals.colors.primary,
  },

  // ---------------- MOTIVATIONAL QUOTE BANNER ----------------
  quoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F3F4',
    borderRadius: globals.radius.md,
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.md,
    padding: globals.spacing.md,
    gap: globals.spacing.sm,
  },
  quoteIcon: {
    fontSize: 18,
  },
  quoteText: {
    flex: 1,
    fontSize: globals.fontSize.sm,
    color: globals.colors.text,
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

  // ---------------- QUICK NAV ROW (below sections) ----------------
  quickNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    width: '100%',
    marginTop: 5,
  },
  quickNavItem: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '25%',
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
  e2: {
    flexDirection: 'column',
    height: 100,
    width: '100%',
    backgroundColor: globals.colors.sectionCard,
    borderRadius: globals.radius.md,
    justifyContent: 'center',
  },
  t2: {
    fontSize: 14,
    margin: 10,
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
  hexagonoNavy: {
    backgroundColor: '#2C3E50',
  },
  hexagonoOrange: {
    backgroundColor: '#F2994A',
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
