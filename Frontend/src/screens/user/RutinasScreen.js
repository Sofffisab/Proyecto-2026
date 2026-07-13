import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Rutinas (Usuario) - spec sección 5.
 *
 * @param {function} [onBack]
 */
export default function RutinasScreen({ onBack }) {
  const rutinaOptions = ['Pre-hechas', 'Personalizadas', 'Recomendadas por la App', 'No seguir ninguna rutina'];

  return (
    <ScrollView>
      <Text>Selector de Rutinas</Text>
      {rutinaOptions.map((opt) => (
        <TouchableOpacity key={opt}>
          <Text>{opt}</Text>
        </TouchableOpacity>
      ))}

      <Text>Modo de visualización</Text>
      <TouchableOpacity>
        <Text>Guía paso a paso</Text>
      </TouchableOpacity>
      <TouchableOpacity>
        <Text>Leer por tu cuenta</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
