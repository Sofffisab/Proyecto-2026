// Admin main screen (home tab) — mockup "Pantalla principal admin":
// notifications button, go to "Ver gym" and go to the history screen.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import MenuCard from '../../components/trainer/MenuCard';
import { DumbbellIcon, ClipboardIcon } from '../../components/trainer/TrainerIcons';
import { BellIcon } from '../../components/admin/AdminIcons';

/**
 * @param {function} [onGoToNotifications] - notifications button (onGoToNotifications)
 * @param {function} [onGoToGym]           - "Ver gym"
 * @param {function} [onGoToHistory]       - "Historial"
 */
export default function AdminHomeScreen({ onGoToNotifications, onGoToGym, onGoToHistory }) {
  const { t } = useTranslation();
  return (
    <ScreenBody title={t('admin.home.title')} subtitle={t('admin.home.subtitle')}>
      <TouchableOpacity
        style={styles.banner}
        onPress={onGoToNotifications}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('admin.home.notificationsTitle')}
      >
        <View style={styles.iconCircle}>
          <BellIcon color="#fff" size={26} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.bannerTitle}>{t('admin.home.notificationsTitle')}</Text>
          <Text style={styles.bannerSub}>{t('admin.home.notificationsSub')}</Text>
        </View>
      </TouchableOpacity>

      <MenuCard
        Icon={DumbbellIcon}
        title={t('admin.home.gymTitle')}
        subtitle={t('admin.home.gymSub')}
        onPress={onGoToGym}
      />
      <MenuCard
        Icon={ClipboardIcon}
        title={t('admin.home.historyTitle')}
        subtitle={t('admin.home.historySub')}
        onPress={onGoToHistory}
      />
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.primary,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
    ...globals.shadow.button,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, marginLeft: globals.spacing.md },
  bannerTitle: { color: '#fff', fontSize: globals.fontSize.md, fontWeight: '700' },
  bannerSub: { marginTop: 2, color: 'rgba(255,255,255,0.85)', fontSize: globals.fontSize.sm },
});
