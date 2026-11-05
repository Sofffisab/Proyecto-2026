import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text } from 'react-native';

// 12840 -> "12.840" (manual: Intl no es confiable en todos los motores de RN)
export function formatNumber(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Número que "cuenta" desde 0 hasta `value`. */
export default function AnimatedNumber({ value, duration = 1500, delay = 250, style }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value: v }) => setShown(v * value));
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      anim.stop();
      progress.removeListener(id);
    };
  }, [value, duration, delay, progress]);

  return <Text style={style}>{formatNumber(shown)}</Text>;
}
