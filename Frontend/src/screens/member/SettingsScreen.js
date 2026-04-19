import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import globals from '../../styles/globals';

/**
 * Pantalla de configuracion del miembro.
 * Muestra los datos del perfil y permite editarlos (proxima iteracion).
 */
function MemberSettingsScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Mi perfil</Text>

      <Card>
        <Text style={styles.label}>Nombre</Text>
        <Text style={styles.value}>Usuario Ejemplo</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Objetivo</Text>
        <Text style={styles.value}>No definido</Text>
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

export default MemberSettingsScreen;