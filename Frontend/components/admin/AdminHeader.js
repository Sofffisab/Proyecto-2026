import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import Avatar from '../trainer/Avatar';
import { ChevronLeftIcon } from '../trainer/TrainerIcons';

/**
 * Top bar shared by every admin screen (from the mockups): "Cerrar sesión" on
 * the left, the admin's avatar on the right and — on sub-screens — a back
 * chevron on a second row (that is the mockups' "Botón de Volver").
 *
 * @param {object}   [user]     - { firstName, lastName } for the avatar initials.
 * @param {function} [onLogout] - "Cerrar sesión".
 * @param {function} [onBack]   - if given, renders the "<" row.
 */
export default function AdminHeader({ user, onLogout, onBack }) {
  const { t } = useTranslation();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onLogout} hitSlop={10} accessibilityRole="button">
          <Text style={styles.logout}>{t('admin.header.logout')}</Text>
        </TouchableOpacity>
        <Avatar name={name || 'A'} size={48} />
      </View>

      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('admin.header.back')}
        >
          <ChevronLeftIcon color={globals.colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: globals.colors.surface,
    paddingTop: globals.spacing.lg,
    paddingHorizontal: globals.spacing.md,
    paddingBottom: globals.spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logout: { fontSize: globals.fontSize.md, color: globals.colors.text },
  back: { alignSelf: 'flex-start', marginTop: globals.spacing.xs, marginLeft: -4 },
});
