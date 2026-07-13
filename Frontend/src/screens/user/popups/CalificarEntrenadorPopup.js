import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

/**
 * Pop-up Calificar Entrenador/es - spec sección 3.
 * Aparece al final del día cuando el usuario se va del gym, si recibió ayuda.
 *
 * @param {function} [onCalificar] - Calificar al entrenador (estilo Cabify).
 * @param {function} [onDenunciarNoAyudaron] - Marcar "denunciar" -> "no me ayudaron".
 * @param {function} [onClose] - Botón de Cerrar.
 */
export default function CalificarEntrenadorPopup({ onCalificar, onDenunciarNoAyudaron, onClose }) {
  return (
    <View>
      <Text>Calificar Entrenador/es</Text>

      <TouchableOpacity onPress={onCalificar}>
        <Text>Calificar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onDenunciarNoAyudaron}>
        <Text>No me ayudaron / Denunciar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose}>
        <Text>Cerrar</Text>
      </TouchableOpacity>
    </View>
  );
}
