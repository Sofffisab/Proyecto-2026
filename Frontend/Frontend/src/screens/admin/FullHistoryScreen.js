import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Full History Screen (Admin) - spec section 19.
 * Shows everything that happens on every account (except for private data filtered out).
 *
 * @param {function} [onBack]
 */
export default function FullHistoryScreen({ onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <Text>{t('admin.fullHistory.title')}</Text>
      <Text>{t('common.staticList')}</Text>

      <TouchableOpacity>
        <Text>{t('admin.fullHistory.privacyFilters')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('admin.fullHistory.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
