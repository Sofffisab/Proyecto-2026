import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Historiales (Entrenador) - spec sección 10.
 * Registro de actividad: a quién ayudaron, cuándo lo hicieron, etc.
 *
 * @param {function} [onBack]
 */
export default function TrainerHistorialesScreen({ onBack }) {
  return (
    <ScrollView>
      <Text>Historiales</Text>

      <View>
        <Text>(Registro de actividad estático)</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
