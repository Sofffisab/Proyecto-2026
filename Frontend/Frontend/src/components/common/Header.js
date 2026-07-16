// src/components/common/Header.js

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Reusable top header bar.
 *
 * @param {string} pageTitle  - Main heading displayed in the header.
 * @param {string} [subtitle] - Optional secondary line below the title.
 */
const Header = ({ pageTitle, subtitle }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{pageTitle}</Text>

    {subtitle && (
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  header: {
    width: '100%',
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
    backgroundColor: globals.colors.primary,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.secondary,
  },
  headerSubtitle: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textLight,
    marginTop: globals.spacing.xs,
  },
});

export default Header;
