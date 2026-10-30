import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import globals from '../../styles/globals';

/**
 * AdminBottomNav — persistent footer for ADMIN screens.
 *
 * Tabs (left -> right): briefcase | home | (QR scan) | training | profile.
 * The selected tab is drawn in teal (globals.colors.primary) with a thin
 * underline; the rest are grey. The center QR button is an action (it opens
 * the camera), so it is never "selected".
 *
 * Icons are inline SVG (stroke = currentColor-style `color` prop) so the
 * active colour is applied without needing one PNG per state.
 */
export const ADMIN_TABS = {
  BRIEFCASE: 'briefcase',
  HOME: 'home',
  TRAINING: 'training',
  PROFILE: 'profile',
};

function BriefcaseIcon({ color }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="7" width="18" height="13" rx="2" />
      <Path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <Path d="M3 13h18" />
    </Svg>
  );
}

function HomeIcon({ color }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11.5 12 4l9 7.5" />
      <Path d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9" />
    </Svg>
  );
}

function DumbbellIcon({ color }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="2.5" y="8" width="3" height="8" rx="1" />
      <Rect x="18.5" y="8" width="3" height="8" rx="1" />
      <Rect x="5.5" y="10" width="2" height="4" rx="0.5" />
      <Rect x="16.5" y="10" width="2" height="4" rx="0.5" />
      <Line x1="7.5" y1="12" x2="16.5" y2="12" />
    </Svg>
  );
}

function ProfileIcon({ color }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-3.9 3.6-6 8-6s8 2.1 8 6" />
    </Svg>
  );
}

const ICONS = {
  [ADMIN_TABS.BRIEFCASE]: BriefcaseIcon,
  [ADMIN_TABS.HOME]: HomeIcon,
  [ADMIN_TABS.TRAINING]: DumbbellIcon,
  [ADMIN_TABS.PROFILE]: ProfileIcon,
};

function NavItem({ tab, active, onSelect }) {
  const Icon = ICONS[tab];
  const isActive = active === tab;
  return (
    <TouchableOpacity
      onPress={() => onSelect(tab)}
      activeOpacity={0.7}
      style={styles.iconWrap}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Icon color={isActive ? globals.colors.primary : globals.colors.navInactive} />
      <View style={[styles.underline, isActive && styles.underlineActive]} />
    </TouchableOpacity>
  );
}

/**
 * @param {string}   active   - one of ADMIN_TABS
 * @param {function} onSelect - (tab) => void
 * @param {function} onScanQR - opens the camera
 */
export default function AdminBottomNav({ active, onSelect, onScanQR }) {
  return (
    <View style={styles.footer}>
      <NavItem tab={ADMIN_TABS.BRIEFCASE} active={active} onSelect={onSelect} />
      <NavItem tab={ADMIN_TABS.HOME} active={active} onSelect={onSelect} />
      <TouchableOpacity style={styles.circulo} onPress={onScanQR} activeOpacity={0.85}>
        <Image source={require('../../assets/boxicons_qr-scan.png')} style={styles.qr} />
      </TouchableOpacity>
      <NavItem tab={ADMIN_TABS.TRAINING} active={active} onSelect={onSelect} />
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
