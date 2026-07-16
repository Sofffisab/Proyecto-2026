import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Statistics Screen (Admin) - spec section 16.
 *
 * @param {function} [onBack]
 */
export default function StatisticsScreen({ onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <View>
        <Text>{t('admin.statistics.overviewTitle')}</Text>
        <Text>{t('admin.statistics.overviewStatic')}</Text>
      </View>

      <View>
        <Text>{t('admin.statistics.trainersTitle')}</Text>
        <Text>{t('admin.statistics.trainersStatic')}</Text>
      </View>

      <View>
        <Text>{t('admin.statistics.usersTitle')}</Text>
        <Text>{t('admin.statistics.usersStatic')}</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('admin.statistics.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
