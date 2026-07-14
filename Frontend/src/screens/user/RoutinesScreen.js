import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Routines Screen (User) - spec section 5.
 *
 * @param {function} [onBack]
 */
export default function RoutinesScreen({ onBack }) {
  const { t } = useTranslation();
  const routineOptions = [
    t('user.routines.options.preMade'),
    t('user.routines.options.custom'),
    t('user.routines.options.recommended'),
    t('user.routines.options.none'),
  ];

  return (
    <ScrollView>
      <Text>{t('user.routines.title')}</Text>
      {routineOptions.map((opt) => (
        <TouchableOpacity key={opt}>
          <Text>{opt}</Text>
        </TouchableOpacity>
      ))}

      <Text>{t('user.routines.displayMode')}</Text>
      <TouchableOpacity>
        <Text>{t('user.routines.stepByStepGuide')}</Text>
      </TouchableOpacity>
      <TouchableOpacity>
        <Text>{t('user.routines.readOnYourOwn')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('user.routines.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
