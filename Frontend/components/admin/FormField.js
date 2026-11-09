import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/** Labelled text input used inside FormModal. */
export default function FormField({ label, value, onChangeText, placeholder, keyboardType, multiline, autoCapitalize = 'none' }) {
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={globals.colors.textSecondary}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: globals.spacing.md },
  label: { fontSize: globals.fontSize.sm + 1, color: globals.colors.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: 10,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.surface,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
});
