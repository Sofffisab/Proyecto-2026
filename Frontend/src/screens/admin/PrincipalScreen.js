import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Principal Admin - spec sección 13.
 *
 * @param {function} [onGenerarQR]
 * @param {function} [onGoToVerGym]
 * @param {function} [onBack]
 */
export default function AdminPrincipalScreen({ onGenerarQR, onGoToVerGym, onBack }) {
  return (
    <ScrollView>
      <TouchableOpacity onPress={onGenerarQR}>
        <Text>Generar nuevo QR</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToVerGym}>
        <Text>Ver Gym</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
