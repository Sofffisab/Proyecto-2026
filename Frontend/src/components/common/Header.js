import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

const Header = ({ pageTitle }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{pageTitle}</Text>
    </View>
  );
};

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
});

export default Header;