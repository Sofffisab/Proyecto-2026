import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Historial Completo (Admin) - spec sección 19.
 * Muestra todo lo que pasa en cada cuenta (exceptuando lo privado por filtro de privacidad).
 *
 * @param {function} [onBack]
 */
export default function HistorialCompletoScreen({ onBack }) {
  return (
    <ScrollView>
      <Text>Registro total del sistema</Text>
      <Text>(Lista estática)</Text>

      <TouchableOpacity>
        <Text>Filtros de privacidad</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
