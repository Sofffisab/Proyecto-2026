import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Compact pill button used inside admin cards.
 * variant: 'primary' (filled teal) | 'outline' (teal border) | 'danger' (red outline)
 */
export default function AdminButton({ label, onPress, variant = 'outline', style, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
    >
      <Text style={[styles.label, variant === 'primary' && styles.labelPrimary, variant === 'danger' && styles.labelDanger]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    paddingHorizontal: globals.spacing.md,
    borderRadius: globals.radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: globals.colors.primary, borderColor: globals.colors.primary },
  outline: { backgroundColor: 'transparent', borderColor: globals.colors.primary },
  danger: { backgroundColor: 'transparent', borderColor: globals.colors.danger },
  disabled: { opacity: 0.45 },
  label: { fontSize: globals.fontSize.sm + 1, fontWeight: '700', color: globals.colors.primary },
  labelPrimary: { color: '#fff' },
  labelDanger: { color: globals.colors.danger },
});
