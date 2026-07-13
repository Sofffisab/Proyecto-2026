import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Estadísticas (Admin) - spec sección 16.
 *
 * @param {function} [onBack]
 */
export default function EstadisticasScreen({ onBack }) {
  return (
    <ScrollView>
      <View>
        <Text>Generales del gym</Text>
        <Text>(Porcentajes de uso de máquinas - estático)</Text>
      </View>

      <View>
        <Text>Entrenadores</Text>
        <Text>(Calificación promedio y otros datos - estático)</Text>
      </View>

      <View>
        <Text>Usuarios</Text>
        <Text>(Desactivados, activados, cumplimiento de objetivos - estático)</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
