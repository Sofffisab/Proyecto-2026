import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Boton reutilizable para toda la app.
 *
 * Props:
 * - label (string): texto que muestra el boton
 * - onPress (function): que hace cuando lo apretás
 * - variant (string): 'primary' | 'secondary' | 'danger'  (default: 'primary')
 */
function Button({ label, onPress, variant = 'primary' }) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant]]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
    borderRadius: globals.radius.md,
    alignItems: 'center',
    marginVertical: globals.spacing.sm,
  },
  primary: {
    backgroundColor: globals.colors.primary,
  },
  secondary: {
    backgroundColor: globals.colors.secondary,
    borderWidth: 1,
    borderColor: globals.colors.border,
  },
  danger: {
    backgroundColor: globals.colors.danger,
  },
  label: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
  },
  primaryLabel: {
    color: globals.colors.secondary,
  },
  secondaryLabel: {
    color: globals.colors.text,
  },
  dangerLabel: {
    color: globals.colors.secondary,
  },
});
   
export default Button;