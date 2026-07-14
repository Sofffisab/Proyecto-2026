import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Reports Screen (User) - spec section 3.
 * Previously implemented as a pop-up; converted to a full screen for
 * consistency with the Trainer's Reports Screen (section 11) and because
 * a report has real consequences (progressive penalties, alerts to Admin),
 * which warrants the space and intent of a dedicated screen instead of a modal.
 *
 * @param {function} [onSubmit] - Sends the report straight to review.
 * @param {function} [onBack] - Back button.
 */
export default function ReportsScreen({ onSubmit, onBack }) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <Text>{t('user.reports.target')}</Text>
      {/* Selector: list of trainers, gym members, or app elements (points, achievements, etc.) */}
      <TouchableOpacity>
        <Text>{t('user.reports.selectTarget')}</Text>
      </TouchableOpacity>

      <Text>{t('user.reports.reason')}</Text>
      <TextInput placeholder={t('user.reports.reasonPlaceholder')} />

      <TouchableOpacity onPress={onSubmit}>
        <Text>{t('user.reports.send')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('user.reports.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
