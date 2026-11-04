// src/screens/user/AchievementsGoalsScreen.js
//
// "Logros y metas" (spec section 6). Everything comes from the Backend:
//   - Puntos acumulados  GET /gamification/points  (total + last transactions;
//                        tapping the card shows/hides those movements)
//   - Tus logros         GET /gamification/badges  (unlocked achievements;
//                        "Ver todos" switches between the scrolling row and a grid)
//   - Tus metas          user.objectives (chosen in Settings); progress = this
//                        week's visits (GET /gamification/summary) vs weekly target
// Reloaded every time the screen gets focus.

import React, { useCallback, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import BottomNav from '../../components/common/BottomNav';
import AchievementTile from '../../components/user/AchievementTile';
import GoalProgressCard from '../../components/user/GoalProgressCard';
import { useTranslation } from '../../i18n/I18nContext';
import * as gamificationApi from '../../features/api/services/gamification.api';
import { useAuth } from '../../context/AuthContext';

const GOALS_PREVIEW = 3;
const DEFAULT_WEEKLY_TARGET = 3;
// TrainingFrequency (Settings) -> visits per week.
const WEEKLY_TARGET = { ONE_TO_TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7 };
const KNOWN_OBJECTIVES = ['LOSE_WEIGHT', 'GAIN_MUSCLE', 'IMPROVE_HEALTH', 'INCREASE_ENDURANCE'];

/**
 * @param {function} [onBack] - kept for compatibility (the design has no header bar)
 * @param {function} [onGoToRoutines] - "calendar" footer icon
 * @param {function} [onGoToHome] - "house" footer icon
 * @param {function} [onGoToProfile] - "person" footer icon
 */
export default function AchievementsGoalsScreen({ onGoToRoutines, onGoToHome, onGoToProfile }) {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const k = (name, params) => t(`user.achievementsGoals.${name}`, params);

  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [weekVisits, setWeekVisits] = useState(0);
  const [profile, setProfile] = useState(null); // { objectives, weeklyTrainingDays } from the Backend

  const [showHistory, setShowHistory] = useState(false);
  const [allAchievements, setAllAchievements] = useState(false);
  const [allGoals, setAllGoals] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    // Summary first: it silently unlocks anything the member already earned,
    // so the badges list below is complete.
    const summaryResult = await Promise.allSettled([gamificationApi.getSummary()]).then((r) => r[0]);
    const [pointsResult, achievementsResult] = await Promise.allSettled([
      gamificationApi.getPoints(),
      gamificationApi.getBadges(),
    ]);

    let anyFailed = false;

    if (pointsResult.status === 'fulfilled') {
      setTotalPoints(pointsResult.value.data?.totalPoints ?? 0);
      setTransactions(pointsResult.value.data?.transactions ?? []);
    } else {
      anyFailed = true;
    }

    if (achievementsResult.status === 'fulfilled') {
      const list = achievementsResult.value.data ?? [];
      // Newest unlocked first.
      setAchievements([...list].sort((a, b) => new Date(b.unlockedAt ?? 0) - new Date(a.unlockedAt ?? 0)));
    } else {
      anyFailed = true;
    }

    if (summaryResult.status === 'fulfilled') {
      setWeekVisits(summaryResult.value.data?.weekVisits ?? 0);
      setProfile(summaryResult.value.data ?? null);
    } else {
      anyFailed = true;
    }

    setHadError(anyFailed);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  // Goals = what the member chose in Settings (user.objectives). Progress =
  // this week's gym visits vs. their weekly training target.
  const weeklyTarget = WEEKLY_TARGET[profile?.weeklyTrainingDays ?? user?.weeklyTrainingDays] ?? DEFAULT_WEEKLY_TARGET;
  const goals = (profile?.objectives ?? user?.objectives ?? []).map((objective) => ({
    id: objective,
    title: KNOWN_OBJECTIVES.includes(objective) ? k(`objective.${objective}`) : objective,
    current: Math.min(weekVisits, weeklyTarget),
    target: weeklyTarget,
  }));

  const visibleGoals = allGoals ? goals : goals.slice(0, GOALS_PREVIEW);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {/* ---------------- title ---------------- */}
        <View style={styles.txt}>
          <Text style={styles.title}>{k('title')}</Text>
          <Text style={styles.subtitle}>{k('subtitle')}</Text>
        </View>

        {hadError && <Text style={styles.errorText}>{k('loadError')}</Text>}

        {/* ---------------- puntos acumulados ---------------- */}
        <TouchableOpacity style={styles.pointsCard} onPress={() => setShowHistory((v) => !v)} activeOpacity={0.8} accessibilityRole="button">
          <Image source={require('../../src/assets/Group 95.png')} style={styles.pointsIcon} resizeMode="contain" />
          <View style={styles.pointsText}>
            <Text style={styles.pointsLabel}>{k('pointsTitle')}</Text>
            {loading ? (
              <ActivityIndicator color={globals.colors.primary} style={styles.pointsLoader} />
            ) : (
              <Text style={styles.pointsValue}>{totalPoints}</Text>
            )}
            <Text style={styles.pointsHint}>{k('pointsHint')}</Text>
          </View>
          <Image
            source={require('../../assets/derecha.png')}
            style={[styles.pointsArrow, showHistory && styles.pointsArrowOpen]}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {showHistory && (
          <View style={styles.history}>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>{k('pointsHistoryEmpty')}</Text>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.historyRow}>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyReason} numberOfLines={2}>{tx.reason}</Text>
                    <Text style={styles.historyDate}>{new Date(tx.createdAt).toLocaleDateString(language)}</Text>
                  </View>
                  <Text style={[styles.historyPoints, tx.points < 0 && styles.historyNegative]}>
                    {tx.points > 0 ? `+${tx.points}` : tx.points}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* ---------------- tus logros ---------------- */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, styles.txt]}>{k('achievementsTitle')}</Text>
          {achievements.length > 0 && (
            <TouchableOpacity style={styles.seeAll} onPress={() => setAllAchievements((v) => !v)} hitSlop={8}>
              <Text style={styles.seeAllText}>{allAchievements ? k('seeLess') : k('seeAllMasc')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={globals.colors.primary} />
        ) : achievements.length === 0 ? (
          <Text style={[styles.emptyText, styles.indented]}>{k('achievementsEmpty')}</Text>
        ) : allAchievements ? (
          <View style={[styles.tilesGrid, styles.indented]}>
            {achievements.map((entry) => (
              <AchievementTile
                key={entry.id}
                category={entry.achievement?.category}
                name={entry.achievement?.name}
                description={entry.achievement?.description}
              />
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tilesRow}>
            {achievements.map((entry) => (
              <AchievementTile
                key={entry.id}
                category={entry.achievement?.category}
                name={entry.achievement?.name}
                description={entry.achievement?.description}
              />
            ))}
          </ScrollView>
        )}

        {/* ---------------- tus metas ---------------- */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, styles.txt]}>{k('goalsTitle')}</Text>
          {goals.length > GOALS_PREVIEW && (
            <TouchableOpacity style={styles.seeAll} onPress={() => setAllGoals((v) => !v)} hitSlop={8}>
              <Text style={styles.seeAllText}>{allGoals ? k('seeLess') : k('seeAllFem')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={globals.colors.primary} />
        ) : goals.length === 0 ? (
          <Text style={[styles.emptyText, styles.indented]}>{k('goalsEmpty')}</Text>
        ) : (
          visibleGoals.map((goal) => {
            const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
            return (
              <View key={goal.id} style={styles.goalWrap}>
                <GoalProgressCard
                  type="COMMITMENT"
                  title={goal.title}
                  progressLine={k('weeklyProgress', { current: goal.current, target: goal.target })}
                  percent={percent}
                  percentLabel={`${percent}%`}
                  statusLabel={percent >= 100 ? k('goalDone') : k('goalInProgress')}
                />
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ---------------- FOOTER ----------------
          Shared component: same 5 buttons -> same 5 destinations on every
          screen that has it. This IS the "trophy" destination, so that tab
          is passed as `active` instead of a handler. The QR (camera) button
          has no handler here — Achievements has no scan flow, so it just
          renders disabled, same as any screen without one. */}
      <BottomNav
        active="trophy"
        onGoToCalendar={onGoToRoutines}
        onGoToHome={onGoToHome}
        onGoToProfile={onGoToProfile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 8, paddingTop: 16, paddingBottom: 32 },

  // title block (.txt: margin-left 3%, width 80%)
  txt: { marginLeft: '3%', width: '80%' },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '700', color: globals.colors.text, marginTop: 8, marginBottom: 8 },
  subtitle: { fontSize: 13, lineHeight: 18, color: globals.colors.captionGrey, marginTop: 4, marginBottom: 18 },
  errorText: { color: globals.colors.danger, fontSize: globals.fontSize.sm, textAlign: 'center', marginBottom: 12 },

  // points card (.cuadrado)
  pointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '6%',
    width: '90%',
    height: 100,
    backgroundColor: globals.colors.surface,
    ...globals.shadow.card,
  },
  pointsIcon: { width: '20%', height: 70 },
  pointsText: { marginLeft: 29 },
  pointsLabel: { fontSize: 16, fontWeight: '700', color: globals.colors.accent, marginBottom: 6 },
  pointsValue: { fontSize: 24, fontWeight: '700', color: globals.colors.text, marginBottom: 5 },
  pointsLoader: { alignSelf: 'flex-start', marginVertical: 6 },
  pointsHint: { fontSize: 13, color: globals.colors.captionGrey },
  pointsArrow: { width: '3%', minWidth: 14, height: 17, marginLeft: 29 },
  pointsArrowOpen: { transform: [{ rotate: '90deg' }] },

  // points history (shown when the card is tapped)
  history: {
    marginLeft: '6%',
    width: '90%',
    backgroundColor: globals.colors.surface,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 6,
    ...globals.shadow.card,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: globals.colors.surfaceBorder },
  historyInfo: { flex: 1, paddingRight: 8 },
  historyReason: { fontSize: 12, color: globals.colors.text },
  historyDate: { fontSize: 10, color: globals.colors.captionGrey, marginTop: 2 },
  historyPoints: { fontSize: 13, fontWeight: '700', color: globals.colors.primary },
  historyNegative: { color: globals.colors.danger },

  // section headings (.tus: title left, "Ver todos >" right)
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: globals.colors.text },
  seeAll: { width: '20%' },
  seeAllText: { fontSize: 13, color: globals.colors.accent },

  // achievements (.cuadrados)
  tilesRow: { paddingLeft: '6%', paddingRight: 16, paddingVertical: 6, gap: 12 },
  tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  indented: { marginLeft: '6%' },

  // goals (.caja-progreso)
  goalWrap: { marginBottom: 10, alignItems: 'center' },
  emptyText: { fontSize: 12, color: globals.colors.captionGrey },
});
