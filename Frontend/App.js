import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator, { ROUTES, navigationRef } from './src/navigation/RootNavigator';
import { I18nProvider } from './src/i18n/I18nContext';
import { AuthProvider } from './src/context/AuthContext';
import { HelpRequestAlertProvider } from './src/notifications/HelpRequestAlertProvider';
import usePushNotifications from './src/notifications/usePushNotifications';

// Mounted inside every provider it needs (auth session, alert popup, nav
// ref) so it can just be a hook — see usePushNotifications.js for what it
// actually does.
function PushNotificationsRegistrar() {
  usePushNotifications({ navigationRef, trainerHelpRoute: ROUTES.TRAINER_HELP });
  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <HelpRequestAlertProvider
          onAccept={() => {
            if (navigationRef.isReady()) {
              navigationRef.navigate(ROUTES.TRAINER_HELP);
            }
          }}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="auto" />
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
              <PushNotificationsRegistrar />
            </NavigationContainer>
          </GestureHandlerRootView>
        </HelpRequestAlertProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
