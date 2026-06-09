import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import globals from '../../styles/globals';

/**
 * Edit profile screen for the member.
 * Each field row is an accordion-style expander:
 * tap the row to reveal a text input beneath it.
 *
 * @param {function} [onSave] - Callback fired when the Save button is pressed.
 */

const FIELDS = [
  { key: 'name',         label: 'Name' },
  { key: 'email',        label: 'Email' },
  { key: 'birthdate',    label: 'Date of Birth' },
  { key: 'gender',       label: 'Gender' },
  { key: 'fitnessLevel', label: 'Fitness Level' },
  { key: 'mainGoal',     label: 'Main Goal' },
];

function EditProfileScreen({ onSave }) {
  const [openField, setOpenField] = useState(null);
  const [values, setValues]       = useState({});

  const toggle = (key) =>
    setOpenField((prev) => (prev === key ? null : key));

  const handleChange = (key, text) =>
    setValues((prev) => ({ ...prev, [key]: text }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar placeholder */}
      <View style={styles.avatarWrapper}>
        <View style={styles.avatarCircle} />
      </View>

      {/* Accordion fields */}
      <View style={styles.fieldsWrapper}>
        {FIELDS.map(({ key, label }) => {
          const isOpen = openField === key;
          return (
            <View key={key} style={styles.fieldBlock}>
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => toggle(key)}
                activeOpacity={0.8}
              >
                <Text style={styles.fieldLabel}>{label}</Text>
                <Text style={[styles.fieldArrow, isOpen && styles.fieldArrowOpen]}>
                  {'>'}
                </Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder={`Enter ${label.toLowerCase()}...`}
                    placeholderTextColor={globals.colors.textMuted}
                    value={values[key] ?? ''}
                    onChangeText={(text) => handleChange(key, text)}
                  />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.backgroundAlt,
  },
  content: {
    paddingBottom: globals.spacing.xl,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: globals.spacing.lg,
    paddingTop: globals.spacing.lg,
    paddingBottom: globals.spacing.md,
  },
  screenTitle: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.text,
  },
  saveButton: {
    fontSize: globals.fontSize.lg,
    fontWeight: '600',
    color: globals.colors.textDark,
  },

  // Avatar
  avatarWrapper: {
    alignItems: 'center',
    marginVertical: globals.spacing.lg,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: globals.colors.avatarPlaceholder,
  },

  // Fields
  fieldsWrapper: {
    paddingHorizontal: globals.spacing.md,
    gap: globals.spacing.xs,
  },
  fieldBlock: {
    backgroundColor: globals.colors.secondary,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.md,
    gap: globals.spacing.sm,
  },
  fieldLabel: {
    flex: 1,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
  fieldArrow: {
    fontSize: globals.fontSize.xl,
    color: globals.colors.textMuted,
  },
  fieldArrowOpen: {
    transform: [{ rotate: '90deg' }],
  },

  // Input
  inputWrapper: {
    paddingHorizontal: globals.spacing.md,
    paddingBottom: globals.spacing.md,
    backgroundColor: globals.colors.secondary,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.background,
  },
});

export default EditProfileScreen;