import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Main Screen (Admin) - spec section 13.
 * Pure navigation hub: no own data to fetch. QR generation and "Ver Gym"
 * are separate screens (GenerateQRScreen, ViewGymScreen) that own their
 * own data/actions.
 *
 * @param {function} [onGenerateQR]
 * @param {function} [onGoToViewGym]
 * @param {function} [onBack]
 */
export default function AdminHomeScreen({ onGenerateQR, onGoToViewGym, onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <TouchableOpacity onPress={onGenerateQR}>
        <Text>{t('admin.home.generateQR')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToViewGym}>
        <Text>{t('admin.home.viewGym')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('admin.home.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
