import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import QRScanner from '../../components/common/QRScanner';
import BottomNav from '../../components/common/BottomNav';
import RateTrainerPopup from '../../components/user/RateTrainerPopup';
import { useTranslation } from '../../i18n/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { useSocial } from '../../social/SocialContext';
import * as gamificationApi from '../../features/api/services/gamification.api';
import * as qrApi from '../../features/api/services/qr.api';
import * as assistanceApi from '../../features/api/services/assistance.api';
import * as notificationApi from '../../features/api/services/notification.api';
import * as routineApi from '../../features/api/services/routine.api';
import * as historyApi from '../../features/api/services/history.api';
import { flushQueue } from '../../features/offline/offlineQueue';

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

  // The Social Interaction pop-ups live in social/SocialContext.js (global,
  // driven by Ably). The only thing screens do is tell it when the person
  // enters or leaves the gym, because that is what switches them on/off.
  const { refresh: refreshSocial } = useSocial();

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
      loadTodayRoutines();
      loadWeekActivity();
      // Best-effort silent retry of anything queued while offline.
      flushQueue();
    }, [loadPoints, loadUnreadCount, loadTodayRoutines, loadWeekActivity])
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
      // Entry/exit QR = starts/stops the social interactions (in-gym window).
      if (data?.action === 'CHECK_IN' || data?.action === 'CHECK_OUT') refreshSocial();

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
  const heroMeta = [
    routineExerciseCount(todayRoutine) != null
      ? t('user.home.exercisesCount', { count: routineExerciseCount(todayRoutine) })
      : null,
    routineDuration(todayRoutine) != null
      ? t('user.home.durationMinutes', { count: routineDuration(todayRoutine) })
      : null,
  ].filter(Boolean);

  return (
    <View style={styles.body}>
      {/* ---------------- HEADER: greeting + bell + avatar ---------------- */}
      <View style={styles.espacio}>
        <View style={styles.espacioActions}>
          <TouchableOpacity onPress={onGoToNotifications} style={styles.headerIconButton} hitSlop={8}>
            <Image source={require('../../assets/bell_outline.png')} style={styles.bellImg} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
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
        <Text style={styles.h1}>
          {t('user.home.greeting', { name: user?.firstName || t('user.home.member') })}
        </Text>
        <Text style={styles.espacioSubtitle}>{t('user.home.greetingSubtitle')}</Text>
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
            <Text style={styles.heroTitle} numberOfLines={3}>
              {routinesLoading ? '…' : todayRoutine?.name || t('user.home.noRoutineTitle')}
            </Text>
            {!routinesLoading && heroMeta.length > 0 && (
              <View style={styles.heroMetaRow}>
                {heroMeta.map((item, i) => (
                  <React.Fragment key={item}>
                    {i > 0 && <View style={styles.heroMetaDivider} />}
                    <Text style={styles.heroMeta}>{item}</Text>
                  </React.Fragment>
                ))}
              </View>
            )}
            <View style={styles.heroButton}>
              <Text style={styles.heroButtonLabel}>{t('user.home.startTraining')}</Text>
              <Text style={styles.heroButtonArrow}>→</Text>
            </View>
          </View>
          <View style={styles.heroImageWrap}>
            <Image source={require('../../assets/images 1.png')} style={styles.heroImage} />
            {/* white -> transparent fade so the photo melts into the card */}
            <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
              <Defs>
                <LinearGradient id="heroFade" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
                  <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFade)" />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* ---------------- NEXT TRAINING ---------------- */}
        <Text style={styles.sectionLabel}>{t('user.home.nextTrainingLabel')}</Text>
        <TouchableOpacity style={styles.card} onPress={onGoToRoutines} activeOpacity={0.8}>
          <View style={styles.iconCircle}>
            <Image source={require('../../assets/Imagen.png')} style={styles.iconCircleImg} />
          </View>
          <View style={styles.cardTextCol}>
            <Text style={styles.nextCardDay}>{nextDayLabel}</Text>
            <Text style={styles.nextCardTitle} numberOfLines={1}>
              {routinesLoading ? '…' : nextRoutine?.name || t('user.home.noRoutineTitle')}
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
        <View style={[styles.weekCard]}>
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
        <View style={[styles.card, styles.progressCard]}>
          <View style={styles.iconCircle}>
            <Svg width={26} height={26} viewBox="0 0 26 26">
              <Polyline
                points="3,19 9,12 14,16 22,6"
                fill="none"
                stroke={globals.colors.primary}
                strokeWidth={1.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.7}
              />
              {[[3, 19], [9, 12], [14, 16], [22, 6]].map(([cx, cy]) => (
                <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} fill={globals.colors.primary} opacity={0.7} />
              ))}
            </Svg>
          </View>
          <View style={styles.cardTextCol}>
            <Text style={styles.progressTitle}>
              {t('user.home.trainingsCompletedThisWeek', { done: weekDoneCount, total: WEEK_DAY_LETTERS.length })}
            </Text>
            <Text style={styles.progressSubtitle}>{t('user.home.keepGoing')}</Text>
          </View>
        </View>

        {/* ---------------- MOTIVATIONAL QUOTE BANNER ---------------- */}
        <TouchableOpacity style={styles.quoteBanner} onPress={onGoToAchievementsGoals} activeOpacity={0.8}>
          <Image source={require('../../assets/proicons_trophy.png')} style={styles.quoteIcon} />
          <Text style={styles.quoteText}>{t('user.home.motivationalQuote')}</Text>
          <Text style={styles.chevronDark}>›</Text>
        </TouchableOpacity>

        {/* ---------------- ASK FOR HELP ----------------
            The mockup's Home has no slot for this, but "ask a trainer for
            help" is a core feature (POST /assistance/request), so it stays
            as one quiet card at the bottom. History / Reports / Year
            Wrapped / Log out moved into the "..." menu on the profile. */}
        <TouchableOpacity
          style={[styles.card, styles.helpCard]}
          onPress={handleAskForHelp}
          disabled={helpLoading}
          activeOpacity={0.8}
        >
          <View style={[styles.iconCircle, styles.iconCircleSmall]}>
            <Text style={styles.helpIcon}>?</Text>
          </View>
          <Text style={styles.helpText}>
            {helpLoading ? t('user.home.pedirAyudaLoading') : t('user.home.pedirAyuda')}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        {helpFeedback && (
          <Text style={helpFeedback.type === 'error' ? styles.errorText : styles.successText}>
            {helpFeedback.message}
          </Text>
        )}
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
          <View style={styles.modalCard}>
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
          <View style={styles.modalCard}>
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
    width: '100%',
    paddingTop: 16,
    paddingHorizontal: 22,
    paddingBottom: 6,
  },
  espacioActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
    marginBottom: 14,
  },
  headerIconButton: {
    position: 'relative',
  },
  bellImg: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  bellDot: {
    position: 'absolute',
    top: 0,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: globals.colors.primary,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: globals.colors.avatarPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarText: {
    fontSize: globals.fontSize.sm,
    fontWeight: 'bold',
    color: globals.colors.text,
  },
  h1: {
    fontSize: 26,
    fontWeight: '700',
    color: globals.colors.text,
  },
  espacioSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: globals.colors.textSecondary,
    marginTop: 6,
    maxWidth: 260,
  },

  // ---------------- scroll wrapper ----------------
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: globals.spacing.lg,
  },

  // ---------------- shared card look ----------------
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    ...globals.shadow.card,
  },
  cardTextCol: {
    flex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: globals.colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  iconCircleImg: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    tintColor: globals.colors.primary,
  },

  // ---------------- TODAY HERO CARD ----------------
  heroCard: {
    flexDirection: 'row',
    backgroundColor: globals.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    overflow: 'hidden',
    minHeight: 168,
    ...globals.shadow.card,
  },
  heroTextCol: {
    flex: 1,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 4,
    justifyContent: 'center',
    zIndex: 1,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: globals.colors.primary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: 10,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: globals.colors.textSecondary,
  },
  heroMetaDivider: {
    width: 1,
    height: 10,
    marginHorizontal: 12,
    backgroundColor: '#D0D0D0',
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 10,
    backgroundColor: globals.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...globals.shadow.button,
  },
  heroButtonLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  heroButtonArrow: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 14,
  },
  heroImageWrap: {
    width: 140,
    marginLeft: -40,   // tuck under the text column so the white fade overlaps
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // ---------------- NEXT TRAINING ----------------
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: globals.colors.navInactive,
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 2,
    textTransform: 'uppercase',
  },
  nextCardDay: {
    fontSize: 10,
    color: globals.colors.textSecondary,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  nextCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: globals.colors.text,
  },
  nextCardMeta: {
    fontSize: 9,
    color: globals.colors.textSecondary,
    marginTop: 3,
  },
  chevron: {
    fontSize: 28,
    lineHeight: 28,
    color: globals.colors.text,
    paddingHorizontal: 4,
  },
  chevronDark: {
    fontSize: 24,
    lineHeight: 24,
    color: globals.colors.text,
  },
  viewScheduleLink: {
    color: globals.colors.primary,
    fontWeight: '600',
    fontSize: 11,
    marginTop: 14,
    marginLeft: 2,
  },

  // ---------------- WEEK ROW ----------------
  weekCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: globals.colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 18,
    ...globals.shadow.card,
  },
  weekDayCol: {
    alignItems: 'center',
    gap: 10,
  },
  weekDayLetter: {
    fontSize: 12,
    color: globals.colors.navInactive,
    fontWeight: '600',
  },
  weekDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotDone: {
    backgroundColor: globals.colors.primary,
    borderColor: globals.colors.primary,
  },
  weekDotToday: {
    // partial teal ring, like the "in progress" day in the mockup
    borderWidth: 2,
    borderColor: globals.colors.surfaceBorder,
    borderTopColor: globals.colors.primary,
    borderRightColor: globals.colors.primary,
  },
  weekDotCheck: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // ---------------- PROGRESS CARD ----------------
  progressCard: {
    marginTop: 18,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: globals.colors.text,
  },
  progressSubtitle: {
    fontSize: 11,
    color: globals.colors.textSecondary,
    marginTop: 3,
  },

  // ---------------- MOTIVATIONAL QUOTE BANNER ----------------
  quoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.tealSoft,
    borderRadius: 8,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  quoteIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: globals.colors.primary,
  },
  quoteText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: globals.colors.text,
  },

  // ---------------- ASK FOR HELP ----------------
  helpCard: {
    marginTop: 16,
  },
  helpIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: globals.colors.primary,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: globals.colors.text,
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
  modalCard: {
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
});
