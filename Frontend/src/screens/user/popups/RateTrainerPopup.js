import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../../i18n/I18nContext';

/**
 * Rate Trainer(s) Pop-up - spec section 3.
 * Appears at the end of the day when the user leaves the gym, if they received help.
 *
 * @param {function} [onRate] - Rate the trainer (Cabify-style).
 * @param {function} [onReportNotHelped] - Mark "report" -> "they didn't help me".
 * @param {function} [onClose] - Close button.
 */
export default function RateTrainerPopup({ onRate, onReportNotHelped, onClose }) {
  const { t } = useTranslation();
  return (
    <View>
      <Text>{t('user.popups.rateTrainer.title')}</Text>

      <TouchableOpacity onPress={onRate}>
        <Text>{t('user.popups.rateTrainer.rate')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onReportNotHelped}>
        <Text>{t('user.popups.rateTrainer.reportNotHelped')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose}>
        <Text>{t('user.popups.rateTrainer.close')}</Text>
      </TouchableOpacity>
    </View>
  );
}
