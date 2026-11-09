import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette, shadow, slideThemes } from '../theme';
import AnimatedNumber, { formatNumber } from './AnimatedNumber';
import FadeUp from './FadeUp';
import { useTranslation } from '../../../../i18n/I18nContext';

const NONE = { pointerEvents: 'none' };

function Blobs({ theme }) {
  return (
    <View style={[StyleSheet.absoluteFill, NONE]}>
      <View style={[styles.blob, { width: 380, height: 380, top: -140, right: -150, backgroundColor: theme.blob1 }]} />
      <View style={[styles.blob, { width: 300, height: 300, bottom: -120, left: -130, backgroundColor: theme.blob2 }]} />
      <View style={[styles.ring, { borderColor: theme.accent, top: '58%', right: -30 }]} />
    </View>
  );
}

function ListExtra({ items, theme }) {
  return (
    <View style={styles.listWrap}>
      {items.map((label, i) => (
        <FadeUp key={`${label}-${i}`} delay={700 + i * 220} style={[styles.listItem, shadow.card]}>
          <View style={[styles.listIcon, { backgroundColor: palette.iconCircle }]}>
            <Text style={[styles.listIconText, { color: palette.primary }]}>{i + 1}</Text>
          </View>
          <Text style={styles.listLabel} numberOfLines={2}>{label}</Text>
        </FadeUp>
      ))}
    </View>
  );
}

function BarExtra({ value, total, caption, theme }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(w, { toValue: Math.min(1, value / total), duration: 1300, delay: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [value, total, w]);
  return (
    <FadeUp delay={500} style={styles.barWrap}>
      <View style={[styles.barTrack, { backgroundColor: 'rgba(4,21,31,0.14)' }]}>
        <Animated.View style={[styles.barFill, { backgroundColor: theme.fg, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Text style={[styles.barCaption, { color: theme.muted }]}>{caption}</Text>
    </FadeUp>
  );
}

function StatsExtra({ items, theme }) {
  return (
    <View style={styles.statsRow}>
      {items.map((it, i) => (
        <FadeUp key={it.label} delay={600 + i * 200} style={[styles.statBox, { borderColor: 'rgba(255,255,255,0.18)' }]}>
          <AnimatedNumber value={it.value} delay={700 + i * 200} duration={1100} style={[styles.statValue, { color: theme.accent }]} />
          <Text style={[styles.statLabel, { color: theme.muted }]}>{it.label}</Text>
        </FadeUp>
      ))}
    </View>
  );
}

function RecapExtra({ items }) {
  return (
    <View style={styles.recapGrid}>
      {items.map((it, i) => (
        <FadeUp key={it.label} delay={300 + i * 110} style={[styles.recapCard, shadow.card]}>
          <Text style={styles.recapValue}>{formatNumber(it.value)}</Text>
          <Text style={styles.recapLabel}>{it.label}</Text>
        </FadeUp>
      ))}
    </View>
  );
}

function formatValidUntil(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

function GiftExtra({ percent, concept, conceptCode, validUntil, onRedeem, onClose, theme }) {
  const { t } = useTranslation();
  const pop = useRef(new Animated.Value(0)).current;
  const [redeemed, setRedeemed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const a = Animated.sequence([
      Animated.delay(2100),
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [pop]);

  const handleRedeem = async () => {
    if (busy || redeemed) return;
    setBusy(true);
    try {
      await onRedeem?.();
      setRedeemed(true);
    } finally {
      setBusy(false);
    }
  };

  const until = formatValidUntil(validUntil);
  return (
    <View style={styles.giftWrap}>
      <Animated.View
        style={[
          styles.coupon,
          shadow.card,
          { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
        ]}
      >
        <Text style={styles.couponKicker}>{t('user.wrappedSlides.gift.coupon')}</Text>
        <Text style={styles.couponPercent}>{percent}% OFF</Text>
        <View style={styles.couponDivider} />
        <Text style={styles.couponConcept}>{t('user.wrappedSlides.gift.inYour', { concept: conceptCode ? t(`user.wrappedSlides.gift.concepts.${conceptCode}`) : concept })}</Text>
        {until ? <Text style={styles.couponUntil}>{t('user.wrappedSlides.gift.validUntil', { date: until })}</Text> : null}
      </Animated.View>

      <Animated.View style={[styles.giftButtonWrap, { opacity: pop, pointerEvents: 'auto' }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleRedeem}
          disabled={redeemed}
          style={[styles.giftButton, shadow.button, redeemed && { opacity: 0.7 }]}
        >
          <Text style={styles.giftButtonText}>{redeemed ? t('user.wrappedSlides.gift.claimed') : t('user.wrappedSlides.gift.claim')}</Text>
        </TouchableOpacity>
        {onClose ? (
          <TouchableOpacity onPress={onClose} style={styles.exitLink} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
            <Text style={[styles.exitLinkText, { color: theme.muted }]}>{t('user.wrappedSlides.gift.exit')}</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * Renderiza UNA diapositiva. Se monta de nuevo en cada cambio de slide, así las
 * animaciones de entrada se repiten. El contenedor deja pasar los toques
 * (para que las zonas de tap del reproductor funcionen) salvo el botón del regalo.
 */
export default function SlideView({ slide, onRedeem, onClose }) {
  const theme = slideThemes[slide.theme] ?? slideThemes.night;
  const { extra } = slide;
  const isGift = extra?.type === 'gift';

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, pointerEvents: 'box-none' }]}>
      <Blobs theme={theme} />
      <View style={[styles.content, NONE, isGift && { justifyContent: 'flex-start', paddingTop: TOP_SPACE + 24 }]}>
        <FadeUp delay={0}>
          <Text style={[styles.kicker, { color: theme.accent }]}>{slide.kicker}</Text>
        </FadeUp>

        {slide.big !== undefined && (
          <View>
            <AnimatedNumber value={slide.big} style={[styles.big, { color: theme.fg }]} />
            <FadeUp delay={500}>
              <Text style={[styles.unit, { color: theme.accent }]}>{slide.unit}</Text>
            </FadeUp>
          </View>
        )}

        <FadeUp delay={slide.big !== undefined ? 800 : 250}>
          <Text style={[slide.big !== undefined ? styles.headline : styles.headlineXL, { color: theme.fg }]}>{slide.headline}</Text>
        </FadeUp>

        {slide.body ? (
          <FadeUp delay={slide.big !== undefined ? 1050 : 500}>
            <Text style={[styles.body, { color: theme.muted }]}>{slide.body}</Text>
          </FadeUp>
        ) : null}

        {extra?.type === 'list' && <ListExtra items={extra.items} theme={theme} />}
        {extra?.type === 'bar' && <BarExtra {...extra} theme={theme} />}
        {extra?.type === 'stats' && <StatsExtra items={extra.items} theme={theme} />}
        {extra?.type === 'recap' && <RecapExtra items={extra.items} />}
      </View>

      {isGift && (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
          <GiftExtra {...extra} onRedeem={onRedeem} onClose={onClose} theme={theme} />
        </View>
      )}
    </View>
  );
}

const TOP_SPACE = Platform.select({ ios: 112, android: 96, default: 96 });

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.55 },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3, opacity: 0.35 },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: TOP_SPACE, paddingBottom: 40, justifyContent: 'center' },
  kicker: { fontSize: 13, fontWeight: '800', letterSpacing: 2.2, marginBottom: 14 },
  big: { fontSize: 104, fontWeight: '900', letterSpacing: -3, lineHeight: 112 },
  unit: { fontSize: 22, fontWeight: '800', marginTop: 2, marginBottom: 22 },
  headline: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  headlineXL: { fontSize: 40, fontWeight: '900', lineHeight: 46, letterSpacing: -0.5 },
  body: { fontSize: 17, lineHeight: 24, marginTop: 14, fontWeight: '500' },

  listWrap: { marginTop: 22 },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.white, borderRadius: 16, padding: 14, marginBottom: 10 },
  listIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  listIconText: { fontSize: 16, fontWeight: '800' },
  listLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: palette.ink },

  barWrap: { marginTop: 24 },
  barTrack: { height: 14, borderRadius: 7, overflow: 'hidden' },
  barFill: { height: 14, borderRadius: 7 },
  barCaption: { marginTop: 8, fontSize: 14, fontWeight: '600' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  statBox: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 16, marginHorizontal: 4, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '900' },
  statLabel: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  recapGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 22 },
  recapCard: { width: '48%', backgroundColor: palette.white, borderRadius: 16, borderWidth: 1, borderColor: palette.hairline, paddingVertical: 20, alignItems: 'center', marginBottom: 10 },
  recapValue: { fontSize: 30, fontWeight: '900', color: palette.primary },
  recapLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(4,21,31,0.58)', marginTop: 2 },

  giftWrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 28, paddingBottom: 56 },
  coupon: { backgroundColor: palette.mint, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', marginBottom: 20 },
  couponKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 2.2, color: palette.primary },
  couponPercent: { fontSize: 64, fontWeight: '900', color: palette.ink, letterSpacing: -2, marginTop: 6 },
  couponDivider: { height: 2, width: '60%', backgroundColor: 'rgba(4,21,31,0.18)', marginVertical: 12 },
  couponConcept: { fontSize: 20, fontWeight: '800', color: palette.ink },
  couponUntil: { fontSize: 13, fontWeight: '600', color: 'rgba(4,21,31,0.6)', marginTop: 6 },
  giftButtonWrap: {},
  giftButton: { backgroundColor: palette.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  exitLink: { alignItems: 'center', paddingVertical: 14 },
  exitLinkText: { fontSize: 15, fontWeight: '700' },
  giftButtonText: { color: palette.white, fontSize: 17, fontWeight: '800' },
});
