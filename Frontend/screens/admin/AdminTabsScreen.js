// ADMIN shell: header on top, the active screen in the middle and the fixed
// AdminBottomNav footer at the bottom — the footer is rendered ONCE here, so
// it never disappears when moving between tabs or into their sub-screens.
//
// Navigation is internal (same pattern as TrainerTabsScreen): `tab` is the
// selected footer tab and `screen` an optional sub-screen opened from it:
//   management (briefcase) -> prizes | reports | qr
//   home                   -> history   (+ "Ver gym" jumps to the gym tab)
//   gym (dumbbell)         -> members | stats
//   profile                -> (no sub-screens)
// Tapping a footer tab always returns to that tab's root screen.
//
// Everything is static (see ./mockData.js) except the QR screen, which reuses
// the existing AdminQRTab untouched.

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminBottomNav, { ADMIN_TABS } from '../../components/admin/AdminBottomNav';
import AdminQRTab from './AdminQRTab';
import AdminHubScreen, { ADMIN_HUB_TARGETS } from './AdminHubScreen';
import AdminHomeScreen from './AdminHomeScreen';
import AdminGymScreen, { ADMIN_GYM_TARGETS } from './AdminGymScreen';
import AdminProfileScreen from './AdminProfileScreen';
import AdminPrizesScreen from './AdminPrizesScreen';
import AdminReportsScreen from './AdminReportsScreen';
import AdminHistoryScreen from './AdminHistoryScreen';
import AdminMembersScreen from './AdminMembersScreen';
import AdminStatsScreen from './AdminStatsScreen';

const SUB = {
  ...ADMIN_HUB_TARGETS, // prizes | reports | qr
  ...ADMIN_GYM_TARGETS, // members | stats
  HISTORY: 'history',
};

/**
 * @param {object}   user                  - logged-in admin (AuthContext)
 * @param {function} onLogout              - "Cerrar sesión"
 * @param {function} [onGoToNotifications] - notifications button on the home tab
 * @param {function} [onScanQR]            - center footer button (inert until wired)
 */
export default function AdminTabsScreen({ user, onLogout, onGoToNotifications, onScanQR }) {
  // "Pantalla principal admin" is the home tab, so start there.
  const [nav, setNav] = useState({ tab: ADMIN_TABS.HOME, screen: null });

  const selectTab = (tab) => setNav({ tab, screen: null });
  const open = (screen) => setNav((n) => ({ ...n, screen }));
  const back = () => setNav((n) => ({ ...n, screen: null }));

  let content;
  switch (nav.screen) {
    case SUB.PRIZES:
      content = <AdminPrizesScreen />;
      break;
    case SUB.REPORTS:
      content = <AdminReportsScreen />;
      break;
    case SUB.QR:
      // Existing admin QR screen (generate / regenerate QRs), unchanged.
      content = <AdminQRTab />;
      break;
    case SUB.HISTORY:
      content = <AdminHistoryScreen />;
      break;
    case SUB.MEMBERS:
      content = <AdminMembersScreen />;
      break;
    case SUB.STATS:
      content = <AdminStatsScreen />;
      break;
    default:
      if (nav.tab === ADMIN_TABS.MANAGEMENT) content = <AdminHubScreen onOpen={open} />;
      else if (nav.tab === ADMIN_TABS.GYM) content = <AdminGymScreen onOpen={open} />;
      else if (nav.tab === ADMIN_TABS.PROFILE) content = <AdminProfileScreen user={user} />;
      else {
        content = (
          <AdminHomeScreen
            onGoToNotifications={onGoToNotifications}
            onGoToGym={() => selectTab(ADMIN_TABS.GYM)}
            onGoToHistory={() => open(SUB.HISTORY)}
          />
        );
      }
  }

  return (
    <View style={styles.container}>
      <AdminHeader user={user} onLogout={onLogout} onBack={nav.screen ? back : undefined} />
      <View style={styles.body}>{content}</View>
      <AdminBottomNav active={nav.tab} onSelect={selectTab} onScanQR={onScanQR} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  body: { flex: 1 },
});
