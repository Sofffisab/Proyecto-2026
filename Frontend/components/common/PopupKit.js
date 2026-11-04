// src/components/common/PopupKit.js
//
// Building blocks of the "friendly pop-up" look used by the social
// interactions (SocialInteractionPopup) and the exit pop-up (CheckoutPopup):
// a white rounded card over a dimmed screen, a teal ✕ in the corner, a hero
// illustration, centered title + grey subtitle, a teal filled button and a
// teal outlined one, and soft bordered inner cards.
//
// Only TWO pictures come from /assets (the Figma illustrations); every icon
// below (✕, ‹, ›, user, star, thumbs, flag, check, spinner) is a tiny SVG
// drawn in code, so it stays sharp at any size and needs no file.
//
//   assets/social_amigo.png       two people + "+" with sparkles   (invite)
//   assets/social_encontrado.png  check in a circle with sparkles  (found / thanks)

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Animated,
  Easing,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Svg, { G, Path, Circle, Polyline, Polygon, Line } from 'react-native-svg';
import globals from '../../styles/globals';

const { colors } = globals;

// Browsers draw a black focus ring on the first pressable of a Modal.
const noOutline = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;

export const HERO = {
  friend: require('../../assets/social_amigo.png'),
  found: require('../../assets/social_encontrado.png'),
};

// ── icons ───────────────────────────────────────────────────────────────

function Icon({ size = 20, color = colors.primary, strokeWidth = 2, fill = 'none', children }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G
        fill={fill}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </G>
    </Svg>
  );
}

export const CloseIcon = (p) => (
  <Icon {...p}>
    <Line x1="6" y1="6" x2="18" y2="18" />
    <Line x1="18" y1="6" x2="6" y2="18" />
  </Icon>
);

export const BackIcon = (p) => (
  <Icon {...p}>
    <Polyline points="15 5 8 12 15 19" />
  </Icon>
);

export const ChevronRightIcon = (p) => (
  <Icon {...p}>
    <Polyline points="9 5 16 12 9 19" />
  </Icon>
);

export const CheckIcon = (p) => (
  <Icon {...p}>
    <Polyline points="20 6 9 17 4 12" />
  </Icon>
);

export const UserIcon = (p) => (
  <Icon {...p}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21c0-4.2 3.6-6.5 8-6.5s8 2.3 8 6.5" />
  </Icon>
);

export const StarIcon = ({ filled, color = colors.primary, ...p }) => (
  <Icon {...p} color={filled ? color : '#C9C9C9'} fill={filled ? color : 'none'} strokeWidth={1.6}>
    <Polygon points="12 3 14.9 9 21.5 9.9 16.7 14.5 17.9 21 12 17.8 6.1 21 7.3 14.5 2.5 9.9 9.1 9" />
  </Icon>
);

export const ThumbIcon = ({ up = true, ...p }) => (
  <View style={up ? null : { transform: [{ rotate: '180deg' }] }}>
    <Icon {...p}>
      <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3z" />
      <Path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </Icon>
  </View>
);

export const FlagIcon = (p) => (
  <Icon {...p}>
    <Path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <Line x1="4" y1="22" x2="4" y2="15" />
  </Icon>
);

/** Ring with a gap that turns — "Buscando un amigo…". */
export function Spinner({ size = 30, color = colors.primary }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Path
          d="M16 4 A12 12 0 1 1 4 16"
          fill="none"
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

// ── layout pieces ───────────────────────────────────────────────────────

/**
 * Dimmed screen + white card. `onClose` draws the ✕ (top right), `onBack` a ‹
 * (top left). Content scrolls if it ever gets taller than the screen.
 */
export function PopupModal({ children, onClose, closeLabel, onBack, backLabel, onRequestClose }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onRequestClose ?? onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.cardContent}
          >
            {children}
          </ScrollView>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              style={styles.backBtn}
            >
              <BackIcon size={20} />
            </TouchableOpacity>
          ) : null}
          {onClose ? (
            <TouchableOpacity
              onPress={onClose}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              style={styles.closeBtn}
            >
              <CloseIcon size={20} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** Illustration from /assets (centered). */
export function Hero({ source, width = 96, height = 52 }) {
  return <Image source={source} style={{ width, height, marginBottom: 14 }} resizeMode="contain" />;
}

/** Teal circle with a spinner / any icon inside. */
export function SoftCircle({ children, size = 58 }) {
  return (
    <View style={[styles.softCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      {children}
    </View>
  );
}

export function Title({ children, align = 'center', style }) {
  return <Text style={[styles.title, { textAlign: align }, style]}>{children}</Text>;
}

export function Subtitle({ children, align = 'center', style }) {
  return <Text style={[styles.subtitle, { textAlign: align }, style]}>{children}</Text>;
}

export function PrimaryButton({ label, onPress, disabled, loading, style }) {
  return (
    <TouchableOpacity
      style={[styles.btn, styles.btnPrimary, disabled && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={[styles.btnText, styles.btnTextPrimary]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function OutlineButton({ label, onPress, disabled, style }) {
  return (
    <TouchableOpacity
      style={[styles.btn, styles.btnOutline, disabled && styles.btnDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <Text style={[styles.btnText, styles.btnTextOutline]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Bordered inner card (friend row, rating box, category row…). */
export function SoftCard({ children, onPress, style }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.softCard, style]}
      {...(onPress ? { onPress, activeOpacity: 0.7, accessibilityRole: 'button' } : {})}
    >
      {children}
    </Wrapper>
  );
}

export function Avatar({ size = 34 }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <UserIcon size={Math.round(size * 0.58)} />
    </View>
  );
}

export function Stars({ value = 0, onChange, size = 26, gap = 3 }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => onChange?.(n === value ? 0 : n)}
          disabled={!onChange}
          hitSlop={6}
          style={[{ marginHorizontal: gap }, noOutline]}
          accessibilityRole="button"
          accessibilityLabel={`${n}`}
        >
          <StarIcon size={size} filled={n <= value} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Square 👍 / 👎 button. */
export function ThumbButton({ up, selected, onPress, label }) {
  const activeColor = up ? colors.primary : colors.danger;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(selected) }}
      style={[
        styles.thumb,
        selected
          ? { backgroundColor: activeColor, borderColor: activeColor }
          : { backgroundColor: '#FFFFFF', borderColor: up ? colors.primary : '#E7B9B9' },
      ]}
    >
      <ThumbIcon up={up} size={22} color={selected ? '#FFFFFF' : up ? colors.primary : colors.danger} />
    </TouchableOpacity>
  );
}

/** Teal tick box used in the denuncia lists. */
export function CheckRow({ checked, label, onPress }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onPress} activeOpacity={0.7} accessibilityRole="checkbox">
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <CheckIcon size={14} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export const popupStyles = StyleSheet.create({
  stack: { alignSelf: 'stretch' },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  gapSm: { marginTop: 8 },
  gapMd: { marginTop: 16 },
  gapLg: { marginTop: 24 },
  muted: { color: colors.textSecondary, fontSize: 11 },
  error: { color: colors.danger, fontSize: 12, textAlign: 'center', marginTop: 10 },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: globals.spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderRadius: 10,
    ...globals.shadow.card,
  },
  cardContent: {
    paddingTop: 34,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 12, right: 12 , ...noOutline },
  backBtn: { position: 'absolute', top: 12, left: 12 , ...noOutline },

  softCircle: {
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    alignSelf: 'stretch',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    alignSelf: 'stretch',
  },

  btn: {
    ...noOutline,
    alignSelf: 'stretch',
    minHeight: 40,
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary, ...globals.shadow.button },
  btnOutline: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.primary },
  btnDisabled: { opacity: 0.55 },
  btnText: { fontSize: 13, fontWeight: '700' },
  btnTextPrimary: { color: '#FFFFFF' },
  btnTextOutline: { color: colors.primary },

  softCard: {
    ...noOutline,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...globals.shadow.card,
  },
  avatar: {
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  thumb: {
    ...noOutline,
    width: 56,
    height: 40,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, alignSelf: 'stretch' },
  box: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { color: colors.text, fontSize: 13, flex: 1 },
});
