import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Rewards Screen (Admin) - spec section 17.
 *
 * @param {function} [onBack]
 */
export default function RewardsScreen({ onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <View>
        <Text>{t('admin.rewards.stockStatusTitle')}</Text>
        <Text>{t('admin.rewards.stockStatusStatic')}</Text>
      </View>

      <View>
        <Text>{t('admin.rewards.shipmentsInProgressTitle')}</Text>
        <Text>{t('common.staticList')}</Text>
      </View>

      <View>
        <Text>{t('admin.rewards.waitlistTitle')}</Text>
        <Text>{t('common.staticList')}</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('admin.rewards.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
