import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { RoutinesProvider } from './context/RoutinesContext';
import { SocialProvider } from './social/SocialContext';
import { I18nProvider } from './i18n/I18nContext';
import RootNavigator from './navigation/RootNavigator';
import LanguageSync from './components/common/LanguageSync';

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <LanguageSync />
        <RoutinesProvider>
          <SocialProvider>
            <RootNavigator />
          </SocialProvider>
        </RoutinesProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
