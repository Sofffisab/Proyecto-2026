import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { HomeIcon, DumbbellIcon, ProfileIcon } from '../trainer/TrainerIcons';
import { BriefcaseIcon } from './AdminIcons';

/**
 * AdminBottomNav — the ADMIN's persistent footer.
 *
 * Fixed component: AdminTabsScreen renders it ONCE, below the screen body,
 * so it is visible on EVERY admin screen (tabs and their sub-screens).
 *
 * Tabs (left -> right): briefcase | home | (QR scan) | dumbbell | profile
 *   briefcase -> management hub (prizes, reports, QR generation)
 *   home      -> main admin screen (notifications, gym, history)
 *   dumbbell  -> "Ver gym" (members, statistics)
 *   profile   -> admin profile
 * The selected tab is teal with a thin underline; the rest are grey. The
 * center QR button is an action, never "selected".
 */
export const ADMIN_TABS = {
  MANAGEMENT: 'management',
  HOME: 'home',
  GYM: 'gym',
  PROFILE: 'profile',
};

const ICONS = {
  [ADMIN_TABS.MANAGEMENT]: BriefcaseIcon,
  [ADMIN_TABS.HOME]: HomeIcon,
  [ADMIN_TABS.GYM]: DumbbellIcon,
  [ADMIN_TABS.PROFILE]: ProfileIcon,
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
      accessibilityLabel={t(`admin.nav.${tab}`)}
      accessibilityState={{ selected: isActive }}
    >
      <Icon color={isActive ? globals.colors.primary : globals.colors.navInactive} />
      <View style={[styles.underline, isActive && styles.underlineActive]} />
    </TouchableOpacity>
  );
}

/**
 * @param {string}   active     - one of ADMIN_TABS
 * @param {function} onSelect   - (tab) => void
 * @param {function} [onScanQR] - center QR button (omit to render it inert)
 */
export default function AdminBottomNav({ active, onSelect, onScanQR }) {
  const { t } = useTranslation();
  return (
    <View style={styles.footer}>
      <NavItem tab={ADMIN_TABS.MANAGEMENT} active={active} onSelect={onSelect} />
      <NavItem tab={ADMIN_TABS.HOME} active={active} onSelect={onSelect} />
      <TouchableOpacity
        style={styles.circulo}
        onPress={onScanQR}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('admin.nav.scanQR')}
      >
        <Image source={require('../../assets/boxicons_qr-scan.png')} style={styles.qr} />
      </TouchableOpacity>
      <NavItem tab={ADMIN_TABS.GYM} active={active} onSelect={onSelect} />
      <NavItem tab={ADMIN_TABS.PROFILE} active={active} onSelect={onSelect} />
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
  underline: { marginTop: 6, height: 2, width: 32, borderRadius: 1, backgroundColor: 'transparent' },
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
