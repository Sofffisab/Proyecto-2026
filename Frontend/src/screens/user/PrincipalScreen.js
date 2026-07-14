import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Footer from '../../components/common/Footer';

/**
 * Pantalla Principal Usuario - spec sección 3.
 * Componentes: contador de puntos, botón cámara QR, accesos a Historiales,
 * Rutinas, Logros y Metas, Denuncias, Pedir Ayuda, Configuración, Wrapped,
 * y cerrar sesión / cambiar de cuenta.
 *
 * @param {number}   [puntos=0] - Puntos acumulados del usuario.
 * @param {function} [onEscanearQR]
 * @param {function} [onGoToHistoriales]
 * @param {function} [onGoToRutinas]
 * @param {function} [onGoToLogrosMetas]
 * @param {function} [onGoToDenuncias] - navega a la Pantalla Denuncias (spec sección 3)
 * @param {function} [onPedirAyuda]
 * @param {function} [onGoToConfiguracion]
 * @param {function} [onGoToWrapped]
 * @param {function} [onLogout] - abre pop-up "estás seguro?"
 * @param {function} [onBack]
 */
export default function PrincipalScreen({
  puntos = 0,
  onEscanearQR,
  onGoToHistoriales,
  onGoToRutinas,
  onGoToLogrosMetas,
  onGoToDenuncias,
  onPedirAyuda,
  onGoToConfiguracion,
  onGoToWrapped,
  onLogout,
  onBack,
}) {
  return (
    <View style={styles.container}>
      <Header pageTitle="Principal" subtitle="Tu resumen de hoy" />

      <ScrollView style={styles.content}>
        <Card title="Puntos acumulados" content={String(puntos)} />

        <View style={styles.buttonGroup}>
          <Button label="Escanear QR (Cámara)" onPress={onEscanearQR} />
          <Button label="Historiales" onPress={onGoToHistoriales} variant="secondary" />
          <Button label="Rutinas" onPress={onGoToRutinas} variant="secondary" />
          <Button label="Logros y Metas" onPress={onGoToLogrosMetas} variant="secondary" />
          <Button label="Denuncias" onPress={onGoToDenuncias} variant="secondary" />
          <Button label="Pedir Ayuda" onPress={onPedirAyuda} variant="secondary" />
          <Button label="Configuración y personalizaciones" onPress={onGoToConfiguracion} variant="secondary" />
          <Button label="Wrapped del año" onPress={onGoToWrapped} variant="secondary" />
          <Button label="Cerrar sesión / Cambiar de cuenta" onPress={onLogout} variant="danger" />
        </View>

        <Text style={styles.backLink} onPress={onBack}>Volver</Text>
      </ScrollView>

      <Footer
        onNavigateHome={onBack}
        onNavigateProfile={onGoToConfiguracion}
        onLogout={onLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    flex: 1,
    padding: globals.spacing.md,
  },
  buttonGroup: {
    marginTop: globals.spacing.md,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
