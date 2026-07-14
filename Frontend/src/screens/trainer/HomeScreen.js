import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Main Screen (Trainer) - spec section 9.
 *
 * @param {function} [onGenerateQR]
 * @param {function} [onGoToHistory]
 * @param {function} [onGoToReports]
 * @param {function} [onGoToHelp]
 * @param {function} [onBack]
 */
export default function TrainerHomeScreen({
  onGenerateQR,
  onGoToHistory,
  onGoToReports,
  onGoToHelp,
  onBack,
}) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <TouchableOpacity onPress={onGenerateQR}>
        <Text>{t('trainer.home.generateQR')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToHistory}>
        <Text>{t('trainer.home.history')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToReports}>
        <Text>{t('trainer.home.reports')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToHelp}>
        <Text>{t('trainer.home.help')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('trainer.home.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
