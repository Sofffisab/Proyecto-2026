import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Wrapped del Año (Usuario - Eventualmente) - spec sección 8.
 * Estadísticas anuales estilo Spotify. Dura 1 mes accesible.
 *
 * @param {function} [onBack]
 */
export default function WrappedScreen({ onBack }) {
  return (
    <ScrollView>
      <Text>Wrapped del Año</Text>

      <View>
        <Text>(Estadísticas anuales estáticas)</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
