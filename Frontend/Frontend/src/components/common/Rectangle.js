import React from 'react';
import { View, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Layout skeleton component used as a wireframe placeholder block.
 *
 * Renders three stacked sections:
 * - Two full-width dark bars     (bar)
 * - Two full-width pill shapes   (pill)
 * - Two small squares side by side (square)
 */
function Rectangle() {
  return (
    <View style={styles.container}>
      {/* Bars */}
      <View style={styles.barWrapper}>
        <View style={styles.bar} />
        <View style={styles.bar} />
      </View>

      {/* Pills */}
      <View style={styles.pillWrapper}>
        <View style={styles.pill} />
        <View style={styles.pill} />
      </View>

      {/* Squares */}
      <View style={styles.squareWrapper}>
        <View style={styles.square} />
        <View style={styles.square} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
    gap: globals.spacing.xl,
    paddingVertical: globals.spacing.lg,
  },

  // Bars section
  barWrapper: {
    alignItems: 'center',
    gap: globals.spacing.lg,
  },
  bar: {
    width: '90%',
    height: 100,
    backgroundColor: globals.colors.primary,
  },

  // Pills section
  pillWrapper: {
    alignItems: 'center',
    gap: globals.spacing.lg,
  },
  pill: {
    width: '90%',
    height: 90,
    backgroundColor: globals.colors.border,
    borderRadius: globals.radius.full,
  },

  // Squares section
  squareWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: globals.spacing.lg,
  },
  square: {
    width: 100,
    height: 50,
    backgroundColor: globals.colors.border,
  },
});

export default Rectangle;
