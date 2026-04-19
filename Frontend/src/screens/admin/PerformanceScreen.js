import { ScrollView, Text, StyleSheet } from 'react-native';
import Button from '../../components/common/Button';
import globals from '../../styles/globals';
import TrainerCard from '../../components/admin/TrainerCard';


const MOCK_TRAINERS = [
  { id: '1', name: 'Carlos Gomez', rating: 4.8, activeMembers: 12 },
  { id: '2', name: 'Sofia Ruiz', rating: 4.2, activeMembers: 8 },
];

function AdminPerformanceScreen({ navigation }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Desempenio de entrenadores</Text>

      {MOCK_TRAINERS.map((trainer) => (
        <TrainerCard key={trainer.id} trainer={trainer} />
      ))}

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
});

export default AdminPerformanceScreen;
