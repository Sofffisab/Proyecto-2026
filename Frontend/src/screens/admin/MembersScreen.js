import { ScrollView, Text, StyleSheet } from 'react-native';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import globals from '../../styles/globals';

/**
 * Pantalla de gestion de miembros (Admin).
 * Lista todos los miembros y permite agregar/modificar roles.
 */

const MOCK_MEMBERS = [
  { id: '1', name: 'Juan Perez', role: 'member' },
  { id: '2', name: 'Maria Lopez', role: 'member' },
  { id: '3', name: 'Carlos Gomez', role: 'trainer' },
];

function AdminMembersScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Todos los miembros</Text>

      {MOCK_MEMBERS.map((m) => (
        <Card key={m.id}>
          <Text style={styles.name}>{m.name}</Text>
          <Text style={styles.role}>Rol: {m.role}</Text>
        </Card>
      ))}

      <Button label="Agregar usuario" onPress={() => {}} />
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
  name: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
  },
  role: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textLight,
    marginTop: globals.spacing.xs,
  },
});

export default AdminMembersScreen;