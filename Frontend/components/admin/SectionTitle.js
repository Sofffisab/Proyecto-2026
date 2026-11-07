import React from 'react';
import { Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/** Section heading inside an admin screen (e.g. "Entrenadores", "Envíos en curso"). */
export default function SectionTitle({ children }) {
  return <Text style={styles.title}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    marginTop: globals.spacing.md,
    marginBottom: globals.spacing.sm,
    fontSize: globals.fontSize.lg,
    fontWeight: '700',
    color: globals.colors.text,
  },
});
