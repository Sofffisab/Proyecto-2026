import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Reports Screen (Trainer) - spec section 11.
 *
 * @param {function} [onSubmit]
 * @param {function} [onBack]
 */
export default function TrainerReportsScreen({ onSubmit, onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <Text>{t('trainer.reports.personToReport')}</Text>
      {/* Selector: list of trainers and gym members */}
      <TouchableOpacity>
        <Text>{t('trainer.reports.selectPerson')}</Text>
      </TouchableOpacity>

      <Text>{t('trainer.reports.reason')}</Text>
      <TextInput placeholder={t('trainer.reports.reasonPlaceholder')} />

      <TouchableOpacity onPress={onSubmit}>
        <Text>{t('trainer.reports.send')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('trainer.reports.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
