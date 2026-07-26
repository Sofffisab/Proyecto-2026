import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Main Screen (Admin) - spec section 13.
 *
 * @param {function} [onGenerateQR]
 * @param {function} [onGoToViewGym]
 * @param {function} [onGoToNotifications]
 * @param {function} [onBack]
 */
export default function AdminHomeScreen({ onGenerateQR, onGoToViewGym, onGoToNotifications, onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <TouchableOpacity onPress={onGenerateQR}>
        <Text>{t('admin.home.generateQR')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToViewGym}>
        <Text>{t('admin.home.viewGym')}</Text>
      </TouchableOpacity>

      {onGoToNotifications && (
        <TouchableOpacity onPress={onGoToNotifications}>
          <Text>{t('admin.home.notifications')}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onBack}>
        <Text>{t('admin.home.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
