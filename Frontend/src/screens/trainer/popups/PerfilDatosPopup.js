import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

/**
 * Pop-up de datos del perfil clickeado en la Pantalla Ayudar - spec sección 12.
 * Muestra: temas médicos, notas, notas públicas, etc.
 *
 * @param {function} [onClose] - Botón de Cerrar.
 */
export default function PerfilDatosPopup({ onClose }) {
  return (
    <View>
      <Text>Datos del usuario</Text>
      <Text>Temas médicos: -</Text>
      <Text>Notas: -</Text>
      <Text>Notas públicas: -</Text>

      <TouchableOpacity onPress={onClose}>
        <Text>Cerrar</Text>
      </TouchableOpacity>
    </View>
  );
}
