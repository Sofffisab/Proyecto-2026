import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Review Reports Screen (Admin) - spec section 18.
 *
 * @param {function} [onBack]
 */
export default function ReviewReportsScreen({ onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <View>
        <Text>{t('admin.reviewReports.approvedTitle')}</Text>
        <Text>{t('admin.reviewReports.approvedStatic')}</Text>
      </View>

      <View>
        <Text>{t('admin.reviewReports.requestsTitle')}</Text>
        <Text>{t('admin.reviewReports.requestsStatic')}</Text>
      </View>

      <View>
        <Text>{t('admin.reviewReports.behaviorTitle')}</Text>
        <Text>{t('admin.reviewReports.behaviorStatic')}</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('admin.reviewReports.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
