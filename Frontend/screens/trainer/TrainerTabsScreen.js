// TRAINER shell: header on top, the active screen in the middle and the fixed
// TrainerBottomNav footer at the bottom — the footer is rendered ONCE here, so
// it never disappears when moving between tabs or into their sub-screens.
//
// Navigation is internal (like AdminTabsScreen): `tab` is the selected footer
// tab and `screen` an optional sub-screen opened from that tab:
//   management (calendar) -> routines | conflicts | report | qr
//   home                  -> help (person data + "Ir a ayudar")
//   profile               -> history
//   gym (dumbbell)        -> (no sub-screens)
// Tapping a footer tab always returns to that tab's root screen.
//
// Every screen loads its data from the Backend (see
// apiClient/services/trainer.api.js). The QR screen reuses AdminQRTab (without
// its admin-only create/deactivate actions).

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import TrainerHeader from '../../components/trainer/TrainerHeader';
import TrainerBottomNav, { TRAINER_TABS } from '../../components/trainer/TrainerBottomNav';
import AdminQRTab from '../admin/AdminQRTab';
import TrainerHomeScreen from './TrainerHomeScreen';
import TrainerHelpScreen from './TrainerHelpScreen';
import TrainerHubScreen, { TRAINER_HUB_TARGETS } from './TrainerHubScreen';
import TrainerRoutineRequestsScreen from './TrainerRoutineRequestsScreen';
import TrainerMachineConflictsScreen from './TrainerMachineConflictsScreen';
import TrainerReportScreen from './TrainerReportScreen';
import TrainerGymScreen from './TrainerGymScreen';
import TrainerProfileScreen from './TrainerProfileScreen';
import TrainerHistoryScreen from './TrainerHistoryScreen';

const SUB = {
  ...TRAINER_HUB_TARGETS, // routines | conflicts | report | qr
  HELP: 'help',
  HISTORY: 'history',
};

/**
 * @param {object}   user                  - logged-in trainer (AuthContext)
 * @param {function} onLogout              - "Cerrar sesión"
 * @param {function} [onGoToNotifications] - bell on the Gym tab
 * @param {function} [onScanQR]            - center footer button (inert until wired)
 */
export default function TrainerTabsScreen({ user, onLogout, onGoToNotifications, onScanQR }) {
  // The mockups' "Pantalla principal" is the home tab, so start there.
  const [nav, setNav] = useState({ tab: TRAINER_TABS.HOME, screen: null, params: null });

  const selectTab = (tab) => setNav({ tab, screen: null, params: null });
  const open = (screen, params = null) => setNav((n) => ({ ...n, screen, params }));
  const back = () => setNav((n) => ({ ...n, screen: null, params: null }));

  let content;
  switch (nav.screen) {
    case SUB.ROUTINES:
      content = <TrainerRoutineRequestsScreen />;
      break;
    case SUB.CONFLICTS:
      content = <TrainerMachineConflictsScreen />;
      break;
    case SUB.REPORT:
      content = <TrainerReportScreen />;
      break;
    case SUB.QR:
      // Existing admin QR screen; trainers can't create/deactivate machines.
      content = <AdminQRTab canManage={false} />;
      break;
    case SUB.HELP:
      content = <TrainerHelpScreen person={nav.params} />;
      break;
    case SUB.HISTORY:
      content = <TrainerHistoryScreen />;
      break;
    default:
      if (nav.tab === TRAINER_TABS.MANAGEMENT) content = <TrainerHubScreen onOpen={(target) => open(target)} />;
      else if (nav.tab === TRAINER_TABS.GYM) content = <TrainerGymScreen />;
      else if (nav.tab === TRAINER_TABS.PROFILE) content = <TrainerProfileScreen user={user} onOpenHistory={() => open(SUB.HISTORY)} />;
      else content = <TrainerHomeScreen onOpenHelp={(person) => open(SUB.HELP, person)} />;
  }

  const showBell = nav.tab === TRAINER_TABS.GYM && !nav.screen;

  return (
    <View style={styles.container}>
      <TrainerHeader
        user={user}
        onLogout={onLogout}
        onBack={nav.screen ? back : undefined}
        onPressNotifications={showBell ? onGoToNotifications : undefined}
      />
      <View style={styles.body}>{content}</View>
      <TrainerBottomNav active={nav.tab} onSelect={selectTab} onScanQR={onScanQR} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  body: { flex: 1 },
});
