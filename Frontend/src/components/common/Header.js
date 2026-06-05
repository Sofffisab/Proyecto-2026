import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

const Header = ({ pageTitle, subtitle }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>{pageTitle}</Text>

    {subtitle && (
      <Text style={styles.headerSubtitle}>
        {subtitle}
      </Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
    backgroundColor: globals.colors.primary,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.secondary,
  },
  headerSubtitle: {
  fontSize: globals.fontSize.sm,
  color: globals.colors.textLight,
  marginTop: 4,
},
});

export default Header;