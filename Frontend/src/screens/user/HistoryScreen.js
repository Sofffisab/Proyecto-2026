import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * History Screen (User) - spec section 4.
 * History list: social interactions, with trainer, machines used,
 * achievements/rewards, points earned, reports, check-in/check-out times.
 *
 * @param {function} [onBack]
 */
export default function HistoryScreen({ onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <Text>{t('user.history.title')}</Text>

      <View>
        <Text>{t('user.history.staticList')}</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('user.history.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
