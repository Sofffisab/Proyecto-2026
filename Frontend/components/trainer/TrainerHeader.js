import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import Avatar from './Avatar';
import { ChevronLeftIcon } from './TrainerIcons';

/**
 * Top bar shared by every trainer screen (from the mockups): "Cerrar sesión"
 * on the left, the trainer's avatar on the right, and — on sub-screens — a
 * back chevron on a second row.
 *
 * @param {object}   [user]                 - { firstName, lastName } for the avatar initials.
 * @param {function} [onLogout]             - "Cerrar sesión".
 * @param {function} [onBack]               - if given, renders the "<" row.
 * @param {function} [onPressNotifications] - if given, renders the bell next to the avatar.
 */
export default function TrainerHeader({ user, onLogout, onBack, onPressNotifications }) {
  const { t } = useTranslation();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onLogout} hitSlop={10} accessibilityRole="button">
          <Text style={styles.logout}>{t('trainer.header.logout')}</Text>
        </TouchableOpacity>

        <View style={styles.right}>
          {onPressNotifications && (
            <TouchableOpacity
              onPress={onPressNotifications}
              style={styles.bell}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('trainer.home.notifications')}
            >
              <Image source={require('../../assets/bell_outline.png')} style={styles.bellImg} />
            </TouchableOpacity>
          )}
          <Avatar name={name || 'T'} size={48} />
        </View>
      </View>

      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          style={styles.back}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('trainer.home.back')}
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
  right: { flexDirection: 'row', alignItems: 'center', gap: globals.spacing.md },
  bell: { padding: globals.spacing.xs },
  bellImg: { width: 26, height: 26, resizeMode: 'contain' },
  back: { alignSelf: 'flex-start', marginTop: globals.spacing.xs, marginLeft: -4 },
});
