// src/screens/trainer/HomeScreen.js

import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import MemberCard from '../../components/trainer/MemberCard';
import globals from '../../styles/globals';

/**
 * Pantalla principal del entrenador.
 * Lista los miembros en el gimnasio y muestra la calificacion actual.
 */

// Datos estaticos de ejemplo hasta que haya backend
const MOCK_MEMBERS = [
  {
    id: '1',
    name: 'Juan Perez',
    machine: 'Cinta',
    goal: 'Bajar de peso',
    lastHelped: 'Hace 2 dias',
    wantsHelp: true,
  },
  {
    id: '2',
    name: 'Maria Lopez',
    machine: 'Pesas',
    goal: 'Ganar masa',
    lastHelped: 'Hoy',
    wantsHelp: false,
  },
];

function TrainerHomeScreen({ navigation }) {
  const { logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Panel Entrenador</Text>

      {/* Calificacion actual del entrenador */}
      <Text style={styles.sectionTitle}>Tu calificacion</Text>
      <Text style={styles.rating}>4.5 / 5</Text>

      {/* Lista de miembros presentes */}
      <Text style={styles.sectionTitle}>Miembros en el gimnasio</Text>
      {MOCK_MEMBERS.map((member) => (
        <MemberCard key={member.id} member={member} />
      ))}

      <Button
        label="Configuracion"
        onPress={() => navigation.navigate('TrainerSettings')}
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
  rating: {
    fontSize: globals.fontSize.xxl,
    fontWeight: 'bold',
    color: globals.colors.primary,
    marginVertical: globals.spacing.sm,
  },
});

export default TrainerHomeScreen;