import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Premios (Admin) - spec sección 17.
 *
 * @param {function} [onBack]
 */
export default function PremiosScreen({ onBack }) {
  return (
    <ScrollView>
      <View>
        <Text>Estado de Stock</Text>
        <Text>(Stock disponible y premio actual - estático)</Text>
      </View>

      <View>
        <Text>Envíos en curso</Text>
        <Text>(Lista estática)</Text>
      </View>

      <View>
        <Text>Lista de espera por falta de stock</Text>
        <Text>(Lista estática)</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
