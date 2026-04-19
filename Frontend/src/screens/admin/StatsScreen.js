import { ScrollView, Text, StyleSheet } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import globals from '../../styles/globals';

/**
 * Pantalla de estadisticas generales del gimnasio (Admin).
 */
function AdminStatsScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Estadisticas</Text>

      <Card>
        <Text style={styles.label}>Miembros activos</Text>
        <Text style={styles.value}>0</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Entrenadores activos</Text>
        <Text style={styles.value}>0</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Maquinas en uso ahora</Text>
        <Text style={styles.value}>0</Text>
      </Card>

      <Card>
        <Text style={styles.label}>Puntos totales otorgados</Text>
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
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.primary,
  },
});

export default AdminStatsScreen;