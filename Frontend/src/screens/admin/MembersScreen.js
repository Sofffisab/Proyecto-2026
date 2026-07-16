import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Members Screen (Admin) - spec section 15.
 *
 * @param {function} [onCreateSession]
 * @param {function} [onDeactivateAccount]
 * @param {function} [onActivateAccount]
 * @param {function} [onBack]
 */
export default function MembersScreen({
  onCreateSession,
  onDeactivateAccount,
  onActivateAccount,
  onBack,
}) {
  const { t } = useTranslation();
  return (
    <ScrollView>
      <Text>{t('admin.members.createNewSession')}</Text>
      <TextInput placeholder={t('admin.members.mailPlaceholder')} keyboardType="email-address" />
      <TouchableOpacity onPress={onCreateSession}>
        <Text>{t('admin.members.createNewSession')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onDeactivateAccount}>
        <Text>{t('admin.members.deactivateAccount')}</Text>
      </TouchableOpacity>

      <View>
        <Text>{t('admin.members.sessionViewer')}</Text>
        <Text>{t('admin.members.sessionViewerStatic')}</Text>
      </View>

      <TouchableOpacity onPress={onActivateAccount}>
        <Text>{t('admin.members.activateAccount')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>{t('admin.members.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
