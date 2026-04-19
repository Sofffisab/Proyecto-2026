import { View, Text, StyleSheet } from 'react-native';
import Card from '../common/Card';
import globals from '../../styles/globals';

/**
 * Muestra la informacion resumida de un entrenador para el admin.
 *
 * Props:
 * - trainer (object): { name, rating, activeMembers }
 */
function TrainerCard({ trainer }) {
  return (
    <Card>
      <Text style={styles.name}>{trainer.name}</Text>
      <Text style={styles.detail}>Calificacion: {trainer.rating} / 5</Text>
      <Text style={styles.detail}>Miembros activos: {trainer.activeMembers}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  name: {
    fontSize: globals.fontSize.lg,
    fontWeight: '700',
    color: globals.colors.text,
    marginBottom: globals.spacing.xs,
  },
  detail: {
    fontSize: globals.fontSize.md,
    color: globals.colors.textLight,
    marginBottom: globals.spacing.xs,
  },
});

export default TrainerCard;