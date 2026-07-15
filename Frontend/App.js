import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation/RootNavigator';
import { I18nProvider } from './src/i18n/I18nContext';
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="auto" />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </GestureHandlerRootView>
      </AuthProvider>
    </I18nProvider>
  );
}
