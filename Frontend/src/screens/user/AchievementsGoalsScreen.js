import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Achievements & Goals Screen (User) - spec section 6.
 * Status panel: achievements, points accumulated, goal progress.
 *
 * @param {function} [onBack]
 */
export default function AchievementsGoalsScreen({ onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <Text>{t('user.achievementsGoals.title')}</Text>

      <View>
        <Text>{t('user.achievementsGoals.staticPanel')}</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('user.achievementsGoals.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
