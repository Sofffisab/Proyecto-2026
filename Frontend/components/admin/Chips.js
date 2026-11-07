import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Horizontal filter chips (single selection).
 * @param {{key:string,label:string}[]} options
 * @param {string}   value
 * @param {function} onChange - (key) => void
 */
export default function Chips({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange?.(o.key)}
            activeOpacity={0.8}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: globals.spacing.sm, paddingBottom: globals.spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: globals.spacing.md,
    borderRadius: globals.radius.full,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    backgroundColor: globals.colors.surface,
  },
  chipOn: { backgroundColor: globals.colors.primary, borderColor: globals.colors.primary },
  label: { fontSize: globals.fontSize.sm + 1, color: globals.colors.text },
  labelOn: { color: '#fff', fontWeight: '700' },
});
