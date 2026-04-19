import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Muestra el codigo QR del miembro.
 * Por ahora es un placeholder visual hasta integrar la libreria de QR.
 *
 * Props:
 * - value (string): dato que codifica el QR (ej: ID del miembro)
 */
function QRDisplay({ value }) {
  return (
    <View style={styles.container}>
      <View style={styles.qrPlaceholder}>
        <Text style={styles.qrText}>QR</Text>
        <Text style={styles.qrValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: globals.spacing.md,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: globals.colors.primary,
    borderRadius: globals.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrText: {
    fontSize: globals.fontSize.xxl,
    fontWeight: 'bold',
    color: globals.colors.primary,
  },
  qrValue: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textLight,
    marginTop: globals.spacing.xs,
  },
});

export default QRDisplay;