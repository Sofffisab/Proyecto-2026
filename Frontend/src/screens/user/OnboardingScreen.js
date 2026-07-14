import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Minimal Profile Personalization Screens (User) - spec section 2.
 * Only appears the first time the user role logs in.
 * Static components, no real selection logic yet.
 *
 * @param {function} [onBack] - Back button (global rule).
 * @param {function} [onContinue] - After finishing the forms, redirects to
 *   Settings to complete the remaining data (spec section 2).
 */
export default function OnboardingScreen({ onBack, onContinue }) {
  const { t } = useTranslation();
  const goalOptions = [1, 2, 3, 4].map((n) => t('user.onboarding.option', { number: n }));
  const levelOptions = [1, 2, 3].map((n) => t('user.onboarding.option', { number: n }));
  const daysOptions = ['1', '2', '3', '4', '5', '6'];
  const trainingTypeOptions = [1, 2, 3, 4].map((n) => t('user.onboarding.option', { number: n }));

  return (
    <ScrollView>
      <View>
        <Text>{t('user.onboarding.mainGoal')}</Text>
        {goalOptions.map((opt) => (
          <TouchableOpacity key={opt}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View>
        <Text>{t('user.onboarding.currentLevel')}</Text>
        {levelOptions.map((opt) => (
          <TouchableOpacity key={opt}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View>
        <Text>{t('user.onboarding.daysPerWeek')}</Text>
        {daysOptions.map((opt) => (
          <TouchableOpacity key={opt}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View>
        <Text>{t('user.onboarding.trainingType')}</Text>
        {trainingTypeOptions.map((opt) => (
          <TouchableOpacity key={opt}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={onContinue}>
        <Text>{t('user.onboarding.continue')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('user.onboarding.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
