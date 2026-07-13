import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Historiales (Usuario) - spec sección 4.
 * Lista de historiales: interacciones sociales, con entrenador, máquinas usadas,
 * logros/premios, puntos sumados, denuncias, horarios de entrada/salida.
 *
 * @param {function} [onBack]
 */
export default function HistorialesScreen({ onBack }) {
  return (
    <ScrollView>
      <Text>Historiales</Text>

      <View>
        <Text>(Lista de historiales estática)</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
