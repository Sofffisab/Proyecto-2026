// src/components/common/RoutineKit.js
//
// Pieces of the redesigned routine flow ("¿Cómo querés entrenar?", "Elegí tu
// rutina", "Rutina personalizada con IA", "Tu cronograma"):
//   - BackHeader   back chevron + big left-aligned title + grey subtitle
//   - ChoiceCard   white card with a teal icon, title, description and a
//                  check/radio on the right (teal border when selected)
//   - Footer       pinned bottom area for the "Siguiente" / "Guardar" button
//   - icons        small SVGs (no image files needed)
// Buttons come from PopupKit (PrimaryButton / OutlineButton).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import globals from '../../styles/globals';
import { BackIcon } from './PopupKit';

const { colors } = globals;

function Icon({ size = 26, color = colors.primary, strokeWidth = 1.7, fill = 'none', children }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

export const GuideIcon = (p) => (
  <Icon {...p}>
    <Rect x="5" y="4.5" width="14" height="17" rx="2" />
    <Path d="M9 4.5V3.5h6v1" />
    <Line x1="9" y1="11" x2="15" y2="11" />
    <Line x1="9" y1="15" x2="15" y2="15" />
  </Icon>
);

export const BookIcon = (p) => (
  <Icon {...p}>
    <Path d="M12 6.5C10 5 7 4.5 3 4.5v14c4 0 7 .5 9 2 2-1.5 5-2 9-2v-14c-4 0-7 .5-9 2z" />
    <Line x1="12" y1="6.5" x2="12" y2="20.5" />
  </Icon>
);

export const PersonIcon = (p) => (
  <Icon {...p}>
    <Circle cx="12" cy="7.5" r="3.5" />
    <Path d="M5 21c0-4 3.2-6 7-6s7 2 7 6" />
    <Path d="M9.5 18.5h5" />
  </Icon>
);

export const BrainIcon = (p) => (
  <Icon {...p}>
    <Path d="M9.5 4A3 3 0 0 0 6.6 6.3 3 3 0 0 0 4.5 11a3 3 0 0 0 1.7 4.7A3 3 0 0 0 9.5 20a2.4 2.4 0 0 0 2.5-2.2V6.2A2.4 2.4 0 0 0 9.5 4z" />
    <Path d="M14.5 4a3 3 0 0 1 2.9 2.3A3 3 0 0 1 19.5 11a3 3 0 0 1-1.7 4.7A3 3 0 0 1 14.5 20a2.4 2.4 0 0 1-2.5-2.2" />
    <Path d="M9 10h1.5M13.5 10H15M9 14h1.5M13.5 14H15" />
  </Icon>
);

export const SparklesIcon = (p) => (
  <Icon {...p}>
    <Path d="M10.5 3l1.9 5.6L18 10.5l-5.6 1.9L10.5 18l-1.9-5.6L3 10.5l5.6-1.9z" />
    <Path d="M19 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
  </Icon>
);

export const DumbbellIcon = (p) => (
  <Icon {...p}>
    <Line x1="6.5" y1="7" x2="6.5" y2="17" />
    <Line x1="3.5" y1="9.5" x2="3.5" y2="14.5" />
    <Line x1="17.5" y1="7" x2="17.5" y2="17" />
    <Line x1="20.5" y1="9.5" x2="20.5" y2="14.5" />
    <Line x1="6.5" y1="12" x2="17.5" y2="12" />
  </Icon>
);

export const ArrowUpIcon = (p) => (
  <Icon {...p} strokeWidth={2.4}>
    <Line x1="12" y1="19" x2="12" y2="6" />
    <Polyline points="6.5 11.5 12 6 17.5 11.5" />
  </Icon>
);

/** Teal round badge with a white tick (selected state of a ChoiceCard). */
function TickBadge({ size = 22 }) {
  return (
    <View style={[styles.tick, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <Polyline points="20 6 9 17 4 12" fill="none" stroke="#FFFFFF" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

/** Top of the flow screens: back chevron, big title, grey subtitle. */
export function BackHeader({ title, subtitle, onBack, backLabel }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} hitSlop={14} accessibilityRole="button" accessibilityLabel={backLabel} style={styles.back}>
          <BackIcon size={22} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.back} />
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * Selectable option. `compact` is the shorter variant used in "Elegí tu rutina".
 * Selected: teal border (+ soft teal fill) and a tick badge; idle: empty ring.
 */
export function ChoiceCard({ icon, title, description, selected, onPress, compact, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected: Boolean(selected) }}
      style={[styles.card, compact ? styles.cardCompact : styles.cardTall, selected && styles.cardSelected, style]}
    >
      <View style={styles.cardIcon}>{icon}</View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        {description ? <Text style={styles.cardDesc}>{description}</Text> : null}
      </View>
      {selected ? <TickBadge /> : <View style={styles.ring} />}
    </TouchableOpacity>
  );
}

/** Pinned bottom area (the primary button of the screen). */
export function Footer({ children }) {
  return <View style={styles.footer}>{children}</View>;
}

export const routineKitStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: 22 },
});

const styles = StyleSheet.create({
  header: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18 },
  back: { width: 28, height: 28, justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 11, lineHeight: 16, color: colors.textSecondary, marginTop: 8 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    ...globals.shadow.card,
  },
  cardTall: { minHeight: 76, paddingVertical: 14 },
  cardCompact: { minHeight: 62, paddingVertical: 10 },
  cardSelected: { borderColor: colors.primary, backgroundColor: '#F2F9FA' },
  cardIcon: { width: 34, alignItems: 'center', marginRight: 12 },
  cardText: { flex: 1, paddingRight: 8 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  cardDesc: { fontSize: 10, lineHeight: 14, color: colors.textSecondary, marginTop: 2 },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CFCFCF', backgroundColor: '#FFFFFF' },
  tick: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  footer: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 },
});
