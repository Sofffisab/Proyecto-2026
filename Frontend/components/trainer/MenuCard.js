import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { ChevronRightIcon } from './TrainerIcons';

/**
 * Big tappable row used for menus ("Gestión" hub, profile -> Historial):
 * soft teal icon circle, bold title, grey caption and a chevron.
 *
 * @param {function} Icon     - icon component from TrainerIcons
 * @param {string}   title
 * @param {string}   [subtitle]
 * @param {function} [onPress]
 */
export default function MenuCard({ Icon, title, subtitle, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
      <View style={styles.iconCircle}>
        <Icon color={globals.colors.primary} size={24} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <ChevronRightIcon color={globals.colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
    ...globals.shadow.card,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: globals.colors.iconCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, marginHorizontal: globals.spacing.md },
  title: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  subtitle: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
});
