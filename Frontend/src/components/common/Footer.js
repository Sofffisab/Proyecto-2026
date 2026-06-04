import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

const Footer = ({ buttons, show = true }) => {
  if (!show) return null;

  return (
    <View style={styles.container}>
      {buttons.map((button, index) => (
        <TouchableOpacity key={index} style={styles.button} onPress={button.onPress}>
          <Text style={styles.buttonText}>{button.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.sm,
    backgroundColor: globals.colors.primary,
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
  },
  button: {
    flex: 1,
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: globals.fontSize.md,
    color: globals.colors.secondary,
    fontWeight: '600',
  },
});

export default Footer;