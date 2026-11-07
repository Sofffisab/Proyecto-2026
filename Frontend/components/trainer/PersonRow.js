import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Avatar from './Avatar';
import { CheckIcon, HandIcon } from './TrainerIcons';

/**
 * Avatar + name card (home list and the "Ayudar" screen).
 *
 * @param {string}   name
 * @param {boolean}  [needsHelp]  - shows a small teal "hand" badge (member pressed "Pedir Ayuda")
 * @param {function} [onPress]    - tapping the row (omit for a non-interactive row)
 * @param {boolean}  [checked]    - checkbox state; the checkbox only renders when `onToggle` is given
 * @param {function} [onToggle]   - checkbox handler ("ya ayudado", visual for now)
 * @param {string}   [checkLabel] - accessibility label of the checkbox
 */
export default function PersonRow({ name, needsHelp, onPress, checked, onToggle, checkLabel }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <View style={styles.row}>
      <Avatar name={name} size={48} />
      <Wrapper
        style={styles.card}
        {...(onPress ? { onPress, activeOpacity: 0.75, accessibilityRole: 'button' } : {})}
      >
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {needsHelp && (
          <View style={styles.badge}>
            <HandIcon color="#fff" size={14} />
          </View>
        )}
        {onToggle && (
          <TouchableOpacity
            onPress={onToggle}
            hitSlop={8}
            style={[styles.checkbox, checked && styles.checkboxOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!checked }}
            accessibilityLabel={checkLabel}
          >
            {checked && <CheckIcon color="#fff" size={14} />}
          </TouchableOpacity>
        )}
      </Wrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: globals.spacing.md },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: globals.spacing.md,
    minHeight: 52,
    paddingHorizontal: globals.spacing.md,
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    ...globals.shadow.card,
  },
  name: { flex: 1, fontSize: globals.fontSize.md, color: globals.colors.text },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: globals.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: globals.spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: globals.colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: globals.colors.primary, borderColor: globals.colors.primary },
});
