import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../../i18n/I18nContext';

/**
 * Social Interaction Pop-up - spec section 3.
 * Appears at a random moment to 2 different users.
 *
 * @param {function} [onNo] - Closes the pop-up.
 * @param {function} [onYes] - Checks if the other person accepts.
 * @param {function} [onClose] - Close button (global pop-up rule).
 */
export default function SocialInteractionPopup({ onNo, onYes, onClose }) {
  const { t } = useTranslation();
  return (
    <View>
      <Text>{t('user.popups.socialInteraction.question')}</Text>

      <TouchableOpacity onPress={onNo}>
        <Text>{t('user.popups.socialInteraction.no')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onYes}>
        <Text>{t('user.popups.socialInteraction.yes')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose}>
        <Text>{t('user.popups.socialInteraction.close')}</Text>
      </TouchableOpacity>
    </View>
  );
}
