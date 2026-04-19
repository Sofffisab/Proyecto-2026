// src/screens/trainer/SettingsScreen.js

import { ScrollView, Text, StyleSheet } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import globals from '../../styles/globals';

/**
 * Pantalla de configuracion del entrenador.
 */
function TrainerSettingsScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mi perfil (Entrenador)</Text>

      <Card>
        <Text style={styles.label}>Nombre</Text>
        <Text style={styles.value}>Entrenador Ejemplo</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Especialidad</Text>
        <Text style={styles.value}>No definida</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Reviews recibidas</Text>
        <Text style={styles.value}>0</Text>
      </Card>

      <Button label="Volver" onPress={() => navigation.goBack()} variant="secondary" />
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
  label: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textLight,
    marginBottom: globals.spacing.xs,
  },
  value: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
});

export default TrainerSettingsScreen;