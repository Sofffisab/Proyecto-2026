import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { I18nProvider } from './i18n/I18nContext';
import RootNavigator from './navigation/RootNavigator';

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </I18nProvider>
  );
}
