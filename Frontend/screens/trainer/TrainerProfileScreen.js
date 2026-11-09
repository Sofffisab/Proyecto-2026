// Trainer profile (person tab): identity block + the "Historial" entry from
// the mockup.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import MenuCard from '../../components/trainer/MenuCard';
import Avatar from '../../components/trainer/Avatar';
import LanguageSelector from '../../components/common/LanguageSelector';
import { ClipboardIcon } from '../../components/trainer/TrainerIcons';

export default function TrainerProfileScreen({ user, onOpenHistory }) {
  const { t } = useTranslation();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || t('trainer.profile.role');

  return (
    <ScreenBody>
      <View style={styles.identity}>
        <Avatar name={name} size={84} />
        <Text style={styles.name}>{name}</Text>
        {!!user?.email && <Text style={styles.email}>{user.email}</Text>}
        <View style={styles.role}>
          <Text style={styles.roleLabel}>{t('trainer.profile.role')}</Text>
        </View>
      </View>

      <MenuCard
        Icon={ClipboardIcon}
        title={t('trainer.history.title')}
        subtitle={t('trainer.profile.historySub')}
        onPress={onOpenHistory}
      />

      <LanguageSelector style={styles.language} />
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  language: { marginTop: globals.spacing.lg },
  identity: { alignItems: 'center', marginBottom: globals.spacing.lg, marginTop: globals.spacing.sm },
  name: { marginTop: globals.spacing.md, fontSize: globals.fontSize.xl, fontWeight: '700', color: globals.colors.text },
  email: { marginTop: 2, fontSize: globals.fontSize.md, color: globals.colors.captionGrey },
  role: {
    marginTop: globals.spacing.sm,
    backgroundColor: globals.colors.tealSoft,
    borderRadius: globals.radius.full,
    paddingVertical: 4,
    paddingHorizontal: globals.spacing.md,
  },
  roleLabel: { fontSize: globals.fontSize.sm + 1, fontWeight: '700', color: globals.colors.primary },
});
