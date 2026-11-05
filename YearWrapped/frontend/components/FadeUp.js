import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/** Aparece desde abajo con fade. `delay` en ms para escalonar elementos. */
export default function FadeUp({ delay = 0, distance = 22, style, children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
