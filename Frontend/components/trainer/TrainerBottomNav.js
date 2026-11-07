import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { CalendarIcon, HomeIcon, DumbbellIcon, ProfileIcon } from './TrainerIcons';

/**
 * TrainerBottomNav — the TRAINER's persistent footer.
 *
 * Fixed component: TrainerTabsScreen renders it once, below the screen body,
 * so it is visible on EVERY trainer screen (tabs and their sub-screens).
 *
 * Tabs (left -> right): calendar | home | (QR scan) | dumbbell | profile
 *   calendar -> management hub (routine requests, machine conflicts, report, QRs)
 *   home     -> people in the gym (main screen)
 *   dumbbell -> gym status
 *   profile  -> trainer profile / history
 * The selected tab is teal with a thin underline; the rest are grey. The
 * center QR button is an action, never "selected".
 */
export const TRAINER_TABS = {
  MANAGEMENT: 'management',
  HOME: 'home',
  GYM: 'gym',
  PROFILE: 'profile',
};

const ICONS = {
  [TRAINER_TABS.MANAGEMENT]: CalendarIcon,
  [TRAINER_TABS.HOME]: HomeIcon,
  [TRAINER_TABS.GYM]: DumbbellIcon,
  [TRAINER_TABS.PROFILE]: ProfileIcon,
};

function NavItem({ tab, active, onSelect }) {
  const { t } = useTranslation();
  const Icon = ICONS[tab];
  const isActive = active === tab;
  return (
    <TouchableOpacity
      onPress={() => onSelect?.(tab)}
      activeOpacity={0.7}
      style={styles.iconWrap}
      accessibilityRole="tab"
      accessibilityLabel={t(`trainer.tabs.${tab}`)}
      accessibilityState={{ selected: isActive }}
    >
      <Icon color={isActive ? globals.colors.primary : globals.colors.navInactive} />
      <View style={[styles.underline, isActive && styles.underlineActive]} />
    </TouchableOpacity>
  );
}

/**
 * @param {string}   active   - one of TRAINER_TABS
 * @param {function} onSelect - (tab) => void
 * @param {function} [onScanQR] - center QR button (omit to render it inert)
 */
export default function TrainerBottomNav({ active, onSelect, onScanQR }) {
  const { t } = useTranslation();
  return (
    <View style={styles.footer}>
      <NavItem tab={TRAINER_TABS.MANAGEMENT} active={active} onSelect={onSelect} />
      <NavItem tab={TRAINER_TABS.HOME} active={active} onSelect={onSelect} />
      <TouchableOpacity
        style={styles.circulo}
        onPress={onScanQR}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('trainer.tabs.scanQR')}
      >
        <Image source={require('../../assets/boxicons_qr-scan.png')} style={styles.qr} />
      </TouchableOpacity>
      <NavItem tab={TRAINER_TABS.GYM} active={active} onSelect={onSelect} />
      <NavItem tab={TRAINER_TABS.PROFILE} active={active} onSelect={onSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    height: 84,
    paddingHorizontal: 6,
    backgroundColor: globals.colors.surface,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  underline: {
    marginTop: 6,
    height: 2,
    width: 32,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  underlineActive: { backgroundColor: globals.colors.primary },
  circulo: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 68,
    width: 68,
    marginBottom: 6,
    backgroundColor: globals.colors.primary,
    borderRadius: 34,
    ...globals.shadow.button,
  },
  qr: { width: 36, height: 36, resizeMode: 'contain' },
});
