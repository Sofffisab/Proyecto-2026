import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/** Small rounded tag. tone: 'teal' (default) | 'grey' | 'danger'. */
export default function StatusPill({ label, tone = 'teal' }) {
  return (
    <View style={[styles.pill, styles[tone]]}>
      <Text style={[styles.label, tone === 'grey' && styles.labelGrey, tone === 'danger' && styles.labelDanger]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: globals.radius.full,
    paddingVertical: 3,
    paddingHorizontal: globals.spacing.sm + 2,
  },
  teal: { backgroundColor: globals.colors.tealSoft },
  grey: { backgroundColor: globals.colors.surfaceBorder },
  danger: { backgroundColor: '#FBE4E4' },
  label: { fontSize: globals.fontSize.sm, fontWeight: '700', color: globals.colors.primary },
  labelGrey: { color: globals.colors.textSecondary },
  labelDanger: { color: globals.colors.danger },
});
