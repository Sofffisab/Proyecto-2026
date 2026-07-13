import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

/**
 * Pop-up Interacción Social - spec sección 3.
 * Aparece en momento aleatorio a 2 usuarios distintos.
 *
 * @param {function} [onNo] - Cierra el pop-up.
 * @param {function} [onSi] - Verifica si el otro acepta.
 * @param {function} [onClose] - Botón de Cerrar (regla global de pop-ups).
 */
export default function InteraccionSocialPopup({ onNo, onSi, onClose }) {
  return (
    <View>
      <Text>¿Quieres?</Text>

      <TouchableOpacity onPress={onNo}>
        <Text>No</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSi}>
        <Text>Sí</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose}>
        <Text>Cerrar</Text>
      </TouchableOpacity>
    </View>
  );
}
