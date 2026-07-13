import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Principal Entrenador - spec sección 9.
 *
 * @param {function} [onGenerarQR]
 * @param {function} [onGoToHistoriales]
 * @param {function} [onGoToDenuncias]
 * @param {function} [onGoToAyudar]
 * @param {function} [onBack]
 */
export default function TrainerPrincipalScreen({
  onGenerarQR,
  onGoToHistoriales,
  onGoToDenuncias,
  onGoToAyudar,
  onBack,
}) {
  return (
    <ScrollView>
      <TouchableOpacity onPress={onGenerarQR}>
        <Text>Generar nuevo QR</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToHistoriales}>
        <Text>Historiales</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToDenuncias}>
        <Text>Denuncias</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToAyudar}>
        <Text>Ayudar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
