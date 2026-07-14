import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../../i18n/I18nContext';

/**
 * Pop-up with profile data clicked from the Help screen - spec section 12.
 * Shows: medical conditions, notes, public notes, etc.
 *
 * @param {function} [onClose] - Close button.
 */
export default function ProfileDataPopup({ onClose }) {
  const { t } = useTranslation();
  return (
    <View>
      <Text>{t('trainer.popups.profileData.title')}</Text>
      <Text>{t('trainer.popups.profileData.medicalConditions')}</Text>
      <Text>{t('trainer.popups.profileData.notes')}</Text>
      <Text>{t('trainer.popups.profileData.publicNotes')}</Text>

      <TouchableOpacity onPress={onClose}>
        <Text>{t('trainer.popups.profileData.close')}</Text>
      </TouchableOpacity>
    </View>
  );
}
