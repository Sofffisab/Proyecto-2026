// src/screens/member/HomeScreen.js

import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import QRDisplay from '../../components/member/QRDisplay';
import globals from '../../styles/globals';

/**
 * Pantalla principal del miembro.
 * Muestra su QR, sus puntos y accesos rapidos.
 */
function MemberHomeScreen({ navigation }) {
  const { logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Hola, Miembro</Text>

      {/* QR personal del miembro para que lo escaneen */}
      <Text style={styles.sectionTitle}>Tu QR</Text>
      <QRDisplay value="MEMBER-001" />

      {/* Puntos acumulados */}
      <Text style={styles.sectionTitle}>Tus puntos</Text>
      <Text style={styles.points}>0 pts</Text>

      {/* Acceso a configuracion */}
      <Button
        label="Configuracion"
        onPress={() => navigation.navigate('MemberSettings')}
        variant="secondary"
      />

      <Button label="Cerrar sesion" onPress={logout} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: globals.spacing.lg,
    backgroundColor: globals.colors.background,
  },
  title: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  sectionTitle: {
    fontSize: globals.fontSize.lg,
    fontWeight: '600',
    color: globals.colors.text,
    marginTop: globals.spacing.md,
  },
  points: {
    fontSize: globals.fontSize.xxl,
    fontWeight: 'bold',
    color: globals.colors.primary,
    marginVertical: globals.spacing.sm,
  },
});

export default MemberHomeScreen;