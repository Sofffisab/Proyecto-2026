import { View, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Tarjeta contenedora reutilizable.
 *
 * Props:
 * - children: contenido dentro de la tarjeta
 * - style: estilos adicionales opcionales
 */
function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: globals.colors.secondary,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginVertical: globals.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2, // sombra en Android
  },
});

export default Card;