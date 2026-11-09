// Frontend/screens/user/yearWrapped/YearWrappedScreen.js
//
// "Wrapped" de fin de año estilo stories (como Spotify), con la estética de la app.
//
// Props:
//   data      payload de GET /wrapped/year (ver Backend/src/services/yearWrapped.service.js).
//   loading   true mientras se pide al backend.
//   error     true si falló el pedido.
//   onRetry   () => void  reintentar.
//   onClose   () => void  cerrar el Wrapped (X arriba a la derecha / "Volver").
//   onRedeem  () => Promise|void  se llama al tocar "Reclamar mi regalo".
//
// Controles: tocar la derecha = siguiente, izquierda = anterior,
// mantener apretado = pausa. Cada slide avanza sola a los ~7 s.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { palette, slideThemes } from './theme';
import { buildSlides } from './slides';
import { useTranslation } from '../../../i18n/I18nContext';
import SlideView from './components/SlideView';

const SLIDE_MS = 7000;

export default function YearWrappedScreen({ data, loading = false, error = false, onRetry, onClose, onRedeem }) {
  const { t } = useTranslation();
  const slides = useMemo(() => (data ? buildSlides(data, t) : []), [data, t]);
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef(null);
  const pausedAt = useRef(0);

  const last = slides.length - 1;
  const isLast = index === last;

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  const run = useCallback(
    (from = 0) => {
      anim.current?.stop();
      progress.setValue(from);
      anim.current = Animated.timing(progress, {
        toValue: 1,
        duration: SLIDE_MS * (1 - from),
        easing: Easing.linear,
        useNativeDriver: false,
      });
      anim.current.start(({ finished }) => finished && next());
    },
    [progress, next]
  );

  // Arranca el temporizador de cada slide (la última no avanza sola).
  useEffect(() => {
    if (!slides.length) return undefined;
    pausedAt.current = 0;
    if (isLast) {
      anim.current?.stop();
      progress.setValue(1);
    } else {
      run(0);
    }
    return () => anim.current?.stop();
  }, [index, slides.length, isLast, run, progress]);

  const pause = () => {
    if (isLast) return;
    anim.current?.stop();
    progress.stopAnimation((v) => {
      pausedAt.current = v;
    });
  };
  const resume = () => {
    if (isLast) return;
    run(pausedAt.current || 0);
  };

  // ---------- estados vacío / carga / error ----------
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.ink }]}>
        <ActivityIndicator color={palette.mint} size="large" />
        <Text style={styles.centerText}>{t('user.wrappedScreen.loading')}</Text>
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: palette.ink }]}>
        <Text style={styles.centerTitle}>{t('user.wrappedScreen.errorTitle')}</Text>
        <Text style={styles.centerText}>{t('user.wrappedScreen.errorBody')}</Text>
        {onRetry ? (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        ) : null}
        {onClose ? (
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backLink}>{t('common.back')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const slide = slides[index];
  const theme = slideThemes[slide.theme] ?? slideThemes.night;
  const barTrack = theme.fg === palette.white ? 'rgba(255,255,255,0.3)' : 'rgba(4,21,31,0.2)';

  return (
    <View style={styles.root}>
      {/* Zonas de toque (debajo): izquierda = atrás, derecha = adelante, mantener = pausa */}
      <View style={[StyleSheet.absoluteFill, styles.zones]}>
        <Pressable style={styles.zoneLeft} onPress={prev} onPressIn={pause} onPressOut={resume} onLongPress={() => {}} delayLongPress={250} />
        <Pressable style={styles.zoneRight} onPress={next} onPressIn={pause} onPressOut={resume} onLongPress={() => {}} delayLongPress={250} />
      </View>

      {/* Slide actual (encima, pero deja pasar los toques salvo el botón del regalo) */}
      <SlideView key={slide.id} slide={slide} onRedeem={onRedeem} onClose={onClose} />

      {/* Barras de progreso + cerrar */}
      <View style={[styles.header, { pointerEvents: 'box-none' }]}>
        <View style={[styles.bars, { pointerEvents: 'none' }]}>
          {slides.map((s, i) => (
            <View key={s.id} style={[styles.barTrack, { backgroundColor: barTrack }]}>
              <Animated.View
                style={[
                  styles.barFill,
                  { backgroundColor: theme.fg },
                  i < index
                    ? { width: '100%' }
                    : i === index
                      ? { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
                      : { width: '0%' },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.headerRow}>
          <Text style={[styles.brand, { color: theme.fg, pointerEvents: 'none' }]}>WRAPPED {data.year}</Text>
          {onClose ? (
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel={t('common.close')}>
              <Text style={[styles.close, { color: theme.fg }]}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink },
  zones: { flexDirection: 'row' },
  zoneLeft: { flex: 1 },
  zoneRight: { flex: 2 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: Platform.select({ ios: 54, android: 36, default: 24 }), paddingHorizontal: 14 },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingHorizontal: 4 },
  brand: { fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  close: { fontSize: 20, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerTitle: { color: palette.white, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  centerText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, textAlign: 'center', marginTop: 12 },
  retryBtn: { marginTop: 24, backgroundColor: palette.primary, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 36 },
  retryText: { color: palette.white, fontWeight: '800', fontSize: 16 },
  backLink: { color: 'rgba(255,255,255,0.6)', marginTop: 20, fontSize: 15 },
});
