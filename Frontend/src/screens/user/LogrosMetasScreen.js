import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla logros y metas (Usuario) - spec sección 6.
 * Panel de estado: logros, puntos acumulados, progreso de metas.
 *
 * @param {function} [onBack]
 */
export default function LogrosMetasScreen({ onBack }) {
  return (
    <ScrollView>
      <Text>Logros y Metas</Text>

      <View>
        <Text>(Panel de estado estático)</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
