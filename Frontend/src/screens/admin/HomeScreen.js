import { ScrollView, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import globals from '../../styles/globals';

/**
 * Pantalla principal del admin.
 * Accesos rapidos a todas las secciones de gestion.
 */
function AdminHomeScreen({ navigation }) {
  const { logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Panel Admin</Text>

      <Button
        label="Ver todos los miembros"
        onPress={() => navigation.navigate('AdminMembers')}
      />
      <Button
        label="Estadisticas"
        onPress={() => navigation.navigate('AdminStats')}
        variant="secondary"
      />
      <Button
        label="Desempenio de entrenadores"
        onPress={() => navigation.navigate('AdminPerformance')}
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
});

export default AdminHomeScreen;