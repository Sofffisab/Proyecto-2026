import React from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  } , [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <Stack>
      {/*screenOptions={{ headerShown: false }} oculta la barra superior por defecto si usas Tailwind */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}