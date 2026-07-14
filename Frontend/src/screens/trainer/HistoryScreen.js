import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * History Screen (Trainer) - spec section 10.
 * Activity log: who they helped, when, etc.
 *
 * @param {function} [onBack]
 */
export default function TrainerHistoryScreen({ onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <Text>{t('trainer.history.title')}</Text>

      <View>
        <Text>{t('trainer.history.staticLog')}</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('trainer.history.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
