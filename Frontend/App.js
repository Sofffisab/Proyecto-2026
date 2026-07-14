import React from 'react';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/auth/LoginScreen';

/**
 * Entry point de la app.
 *
 * Todavía no hay navegación ni conexión a backend: por ahora se muestra
 * directamente la primera pantalla del recorrido (Login - spec sección 1)
 * como punto de partida estático del proyecto.
 */
export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <LoginScreen />
    </>
  );
}
