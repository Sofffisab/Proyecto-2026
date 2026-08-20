
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import BottomNav from '../../components/common/BottomNav';
import { useTranslation } from '../../i18n/I18nContext';
import * as gamificationApi from '../../api/services/gamification.api';
import * as progressApi from '../../api/services/progress.api';

function Section({ title, loading, empty, emptyLabel, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={globals.colors.primary} />
      ) : empty ? (
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      ) : (
        children
      )}
    </View>
  );
}

/**
 * @param {function} [onBack]
 * @param {function} [onGoToRoutines] - "calendar" footer icon
 * @param {function} [onGoToHome] - "house" footer icon
 * @param {function} [onGoToProfile] - "person" footer icon
 */
export default function AchievementsGoalsScreen({ onBack, onGoToRoutines, onGoToHome, onGoToProfile }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [goals, setGoals] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pointsResult, achievementsResult, goalsResult] = await Promise.allSettled([
      gamificationApi.getPoints(),
      gamificationApi.getBadges(),
      progressApi.getGoals(),
    ]);

    let anyFailed = false;

    if (pointsResult.status === 'fulfilled') {
      setTotalPoints(pointsResult.value.data?.totalPoints ?? 0);
    } else {
      anyFailed = true;
    }

    if (achievementsResult.status === 'fulfilled') {
      setAchievements(achievementsResult.value.data ?? []);
    } else {
      anyFailed = true;
    }

    if (goalsResult.status === 'fulfilled') {
      setGoals(goalsResult.value.data ?? []);
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

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.achievementsGoals.title')} />

      <ScrollView style={styles.content}>
        {hadError && <Text style={styles.errorText}>{t('user.achievementsGoals.loadError')}</Text>}

        <Section title={t('user.achievementsGoals.pointsTitle')} loading={loading} empty={false}>
          <Text style={styles.pointsText}>
            {t('user.achievementsGoals.pointsTotal', { points: totalPoints })}
          </Text>
        </Section>

        <Section
          title={t('user.achievementsGoals.goalsTitle')}
          loading={loading}
          empty={goals.length === 0}
          emptyLabel={t('user.achievementsGoals.goalsEmpty')}
        >
          {goals.map((goal) => {
            const percent = goal.targetValue
              ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
              : 0;
            return (
              <View key={goal.id} style={styles.row}>
                <Text style={styles.rowPrimary}>{goal.subType || goal.type}</Text>
                <Text style={styles.rowSecondary}>
                  {t('user.achievementsGoals.goalProgress', {
                    current: goal.currentValue,
                    target: goal.targetValue,
                    unit: goal.unit || '',
                  })}
                </Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                </View>
                <Text style={styles.rowDetail}>
                  {t('user.achievementsGoals.goalPercent', { percent })}
                </Text>
              </View>
            );
          })}
        </Section>

        <Section
          title={t('user.achievementsGoals.achievementsTitle')}
          loading={loading}
          empty={achievements.length === 0}
          emptyLabel={t('user.achievementsGoals.achievementsEmpty')}
        >
          {achievements.map((entry) => (
            <View key={entry.id} style={styles.row}>
              <Text style={styles.rowPrimary}>{entry.achievement?.name}</Text>
              {entry.unlockedAt && (
                <Text style={styles.rowSecondary}>
                  {new Date(entry.unlockedAt).toLocaleString()}
                </Text>
              )}
            </View>
          ))}
        </Section>

        <Text style={styles.backLink} onPress={onBack}>{t('user.achievementsGoals.back')}</Text>
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
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    flex: 1,
    padding: globals.spacing.md,
  },
  section: {
    marginBottom: globals.spacing.lg,
  },
  sectionTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
  },
  pointsText: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.primary,
  },
  row: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  rowPrimary: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    fontWeight: '600',
  },
  rowSecondary: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
  },
  rowDetail: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: globals.radius.full,
    backgroundColor: globals.colors.sectionCard,
    marginTop: globals.spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.full,
  },
  emptyText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
