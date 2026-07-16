import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import ProfileDataPopup from './popups/ProfileDataPopup';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Help Screen (Trainer) - spec section 12.
 * List of people at the gym, ordered by priority (backend).
 *
 * @param {function} [onSelectUser]
 * @param {function} [onBack]
 */
export default function HelpScreen({ onSelectUser, onBack }) {
  const { t } = useTranslation();
  // Clicked profile data pop-up: opens/closes locally, doesn't need
  // its own entry in the navigation stack.
  const [showProfileData, setShowProfileData] = useState(false);

  return (
    <ScrollView>
      <Text>{t('trainer.help.title')}</Text>

      <TouchableOpacity onPress={() => setShowProfileData(true)}>
        <Text>{t('trainer.help.clickableProfile')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSelectUser}>
        <Text>{t('trainer.help.selectUser')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('trainer.help.back')}</Text>
      </TouchableOpacity>

      <Modal
        visible={showProfileData}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileData(false)}
      >
        <ProfileDataPopup onClose={() => setShowProfileData(false)} />
      </Modal>
    </ScrollView>
  );
}
