// src/screens/user/AchievementsGoalsScreen.js
//
// Achievements & Goals Screen (User) - spec section 6:
// "Muestra qué logros tiene, qué puntos tiene acumulados y cuánto va de
// progreso en cada una de sus metas."
//
// Backed by three endpoints, fetched in parallel:
//   - GET /gamification/points  -> totalPoints          (gamification.api.js)
//   - GET /gamification/badges  -> unlocked achievements (gamification.api.js)
//   - GET /goals                -> active goals + progress (progress.api.js)
// Promise.allSettled so one failing section doesn't blank the rest.

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import { useTranslation } from '../../i18n/I18nContext';
import * as gamificationApi from '../../api/services/gamification.api';
import * as progressApi from '../../api/services/progress.api';

// Unstyled manual goal-management panel — spec section 6 goals are
// normally created/completed automatically as the user progresses through
// their normal gym routine (see goalDifficultyEngine.service.js and the
// suggestion engine), not entered by hand. This panel is an explicit
// manual fallback (create/edit/delete a goal, log a progress value)
// wired to the now-mounted PATCH/DELETE /goals/:id and PUT /progress/:id
// endpoints, left intentionally bare (no visual design pass) since it's
// a debug/manual escape hatch rather than the primary flow.
function ManualGoalPanel({ goals, onChanged }) {
  const { t } = useTranslation();
  const [objectiveAction, setObjectiveAction] = useState('GAIN');
  const [objectiveType, setObjectiveType] = useState('WEIGHT');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [progressDrafts, setProgressDrafts] = useState({});

  const handleCreate = async () => {
    if (!targetValue) return;
    setBusy(true);
    setFeedback(null);
    try {
      await progressApi.createGoal({
        objectiveAction,
        objectiveType,
        targetValue: Number(targetValue),
        unit: unit || undefined,
      });
      setTargetValue('');
      setUnit('');
      setFeedback(t('user.achievementsGoals.goalSaved'));
      onChanged();
    } catch (err) {
      setFeedback(err.message || t('user.achievementsGoals.goalError'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (goalId) => {
    setBusy(true);
    setFeedback(null);
    try {
      await progressApi.deleteGoal(goalId);
      setFeedback(t('user.achievementsGoals.goalDeleted'));
      onChanged();
    } catch (err) {
      setFeedback(err.message || t('user.achievementsGoals.goalError'));
    } finally {
      setBusy(false);
    }
  };

  const handleLogProgress = async (goalId) => {
    const value = Number(progressDrafts[goalId]);
    if (!value && value !== 0) return;
    setBusy(true);
    setFeedback(null);
    try {
      await progressApi.addProgressLog({ goalId, value });
      setProgressDrafts((prev) => ({ ...prev, [goalId]: '' }));
      setFeedback(t('user.achievementsGoals.goalSaved'));
      onChanged();
    } catch (err) {
      setFeedback(err.message || t('user.achievementsGoals.goalError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 16 }}>
      <Text style={{ fontWeight: 'bold' }}>{t('user.achievementsGoals.manageGoals')}</Text>
      <Text style={{ fontSize: 12, color: '#666' }}>{t('user.achievementsGoals.manageGoalsNote')}</Text>

      {feedback && <Text>{feedback}</Text>}
      {busy && <ActivityIndicator />}

      <Text>{t('user.achievementsGoals.newGoalAction')}</Text>
      <TextInput value={objectiveAction} onChangeText={setObjectiveAction} style={styles.debugInput} />
      <Text>{t('user.achievementsGoals.newGoalType')}</Text>
      <TextInput value={objectiveType} onChangeText={setObjectiveType} style={styles.debugInput} />
      <Text>{t('user.achievementsGoals.newGoalTarget')}</Text>
      <TextInput value={targetValue} onChangeText={setTargetValue} keyboardType="numeric" style={styles.debugInput} />
      <Text>{t('user.achievementsGoals.newGoalUnit')}</Text>
      <TextInput value={unit} onChangeText={setUnit} style={styles.debugInput} />
      <TouchableOpacity onPress={handleCreate}>
        <Text>{t('user.achievementsGoals.addGoal')}</Text>
      </TouchableOpacity>

      {goals.map((goal) => (
        <View key={goal.id} style={{ borderTopWidth: 1, borderColor: '#eee', marginTop: 8, paddingTop: 8 }}>
          <Text>{goal.subType || goal.type} — {goal.currentValue}/{goal.targetValue} {goal.unit || ''}</Text>
          <TextInput
            placeholder={t('user.achievementsGoals.logProgress')}
            value={progressDrafts[goal.id] ?? ''}
            onChangeText={(v) => setProgressDrafts((prev) => ({ ...prev, [goal.id]: v }))}
            keyboardType="numeric"
            style={styles.debugInput}
          />
          <TouchableOpacity onPress={() => handleLogProgress(goal.id)}>
            <Text>{t('user.achievementsGoals.logProgressAction')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(goal.id)}>
            <Text>{t('user.achievementsGoals.deleteGoal')}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

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
 */
export default function AchievementsGoalsScreen({ onBack }) {
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

        <ManualGoalPanel goals={goals} onChanged={loadAll} />
      </ScrollView>
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
  debugInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 4,
    marginBottom: 4,
  },
});
