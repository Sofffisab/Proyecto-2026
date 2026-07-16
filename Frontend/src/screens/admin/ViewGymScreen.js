import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * "View Gym" Screen (Admin) - spec section 14.
 *
 * @param {function} [onGoToStatistics]
 * @param {function} [onGoToMembers]
 * @param {function} [onGoToRewards]
 * @param {function} [onGoToReviewReports]
 * @param {function} [onGoToHistory]
 * @param {function} [onBack]
 */
export default function ViewGymScreen({
  onGoToStatistics,
  onGoToMembers,
  onGoToRewards,
  onGoToReviewReports,
  onGoToHistory,
  onBack,
}) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <TouchableOpacity onPress={onGoToStatistics}>
        <Text>{t('admin.viewGym.statistics')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToMembers}>
        <Text>{t('admin.viewGym.members')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToRewards}>
        <Text>{t('admin.viewGym.rewards')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToReviewReports}>
        <Text>{t('admin.viewGym.reviewReports')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToHistory}>
        <Text>{t('admin.viewGym.history')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('admin.viewGym.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
