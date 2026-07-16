import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Minimal Profile Personalization Screen (User) - spec section 2.
 * Only appears the first time the user role logs in.
 *
 * Selections map exactly to the Backend enums (see
 * Backend/prisma/schema.prisma and Backend/src/validators/user.schemas.js):
 *   - mainGoal        -> objectives: MainGoal[]        (multi-select)
 *   - currentLevel    -> trainingLevel: ExperienceLevel (single-select)
 *   - daysPerWeek     -> weeklyTrainingDays: TrainingFrequency (single-select)
 *   - trainingType    -> trainingType: TrainingType     (single-select)
 *
 * @param {function} [onBack] - Back button (global rule).
 * @param {function} onContinue - async (payload) => void. Called with the
 *   validated selections; the caller (RootNavigator) is responsible for
 *   persisting them (PUT /users/me) and navigating onward, since the
 *   navigation target depends on the save's outcome.
 */
const GOAL_KEYS = ['LOSE_WEIGHT', 'GAIN_MUSCLE', 'IMPROVE_HEALTH', 'INCREASE_ENDURANCE'];
const LEVEL_KEYS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const DAYS_KEYS = ['ONE_TO_TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN'];
const TRAINING_TYPE_KEYS = ['STRENGTH', 'CARDIO', 'FUNCTIONAL', 'MIXED'];

function OptionGroup({ title, options, selected, onToggle, multi }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {options.map(({ key, label }) => {
        const isSelected = multi ? selected.includes(key) : selected === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.option, isSelected && styles.optionSelected]}
            onPress={() => onToggle(key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
              {isSelected ? (multi ? '☑ ' : '● ') : (multi ? '☐ ' : '○ ')}
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function OnboardingScreen({ onBack, onContinue }) {
  const { t } = useTranslation();

  const [goals, setGoals] = useState([]);
  const [level, setLevel] = useState(null);
  const [days, setDays] = useState(null);
  const [trainingType, setTrainingType] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const goalOptions = GOAL_KEYS.map((key) => ({ key, label: t(`user.onboarding.goals.${key}`) }));
  const levelOptions = LEVEL_KEYS.map((key) => ({ key, label: t(`user.onboarding.levels.${key}`) }));
  const daysOptions = DAYS_KEYS.map((key) => ({ key, label: t(`user.onboarding.days.${key}`) }));
  const trainingTypeOptions = TRAINING_TYPE_KEYS.map((key) => ({
    key,
    label: t(`user.onboarding.trainingTypes.${key}`),
  }));

  const toggleGoal = (key) =>
    setGoals((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));

  const handleContinue = async () => {
    if (goals.length === 0 || !level || !days || !trainingType) {
      setError(t('user.onboarding.errorSaving'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onContinue({
        objectives: goals,
        trainingLevel: level,
        weeklyTrainingDays: days,
        trainingType,
      });
    } catch (err) {
      setError(err.message || t('user.onboarding.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('user.onboarding.mainGoal')}</Text>
      <Text style={styles.hint}>{t('user.onboarding.mainGoalHint')}</Text>
      <OptionGroup
        title={t('user.onboarding.mainGoal')}
        options={goalOptions}
        selected={goals}
        onToggle={toggleGoal}
        multi
      />

      <OptionGroup
        title={t('user.onboarding.currentLevel')}
        options={levelOptions}
        selected={level}
        onToggle={setLevel}
      />

      <OptionGroup
        title={t('user.onboarding.daysPerWeek')}
        options={daysOptions}
        selected={days}
        onToggle={setDays}
      />

      <OptionGroup
        title={t('user.onboarding.trainingType')}
        options={trainingTypeOptions}
        selected={trainingType}
        onToggle={setTrainingType}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[styles.continueButton, saving && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={globals.colors.background} />
        ) : (
          <Text style={styles.continueButtonText}>{t('user.onboarding.continue')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} disabled={saving}>
        <Text style={styles.backText}>{t('user.onboarding.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    padding: globals.spacing.md,
    gap: globals.spacing.md,
  },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: '700',
    color: globals.colors.text,
  },
  hint: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: -globals.spacing.xs,
  },
  group: {
    marginTop: globals.spacing.sm,
    gap: globals.spacing.xs,
  },
  groupTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  option: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.sm,
    backgroundColor: globals.colors.secondary,
  },
  optionSelected: {
    borderColor: globals.colors.primary,
    backgroundColor: globals.colors.primary + '20',
  },
  optionText: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
  optionTextSelected: {
    color: globals.colors.primary,
    fontWeight: '600',
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
  },
  continueButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.md,
    paddingVertical: globals.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: globals.spacing.md,
    minHeight: 50,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: globals.colors.background,
    fontSize: globals.fontSize.md,
    fontWeight: '600',
  },
  backText: {
    color: globals.colors.primary,
    fontSize: globals.fontSize.sm,
    textAlign: 'center',
    paddingVertical: globals.spacing.md,
  },
});
