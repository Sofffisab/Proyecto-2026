import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla "Ver Gym" (Admin) - spec sección 14.
 *
 * @param {function} [onGoToEstadisticas]
 * @param {function} [onGoToMiembros]
 * @param {function} [onGoToPremios]
 * @param {function} [onGoToRevisarDenuncias]
 * @param {function} [onGoToHistorial]
 * @param {function} [onBack]
 */
export default function VerGymScreen({
  onGoToEstadisticas,
  onGoToMiembros,
  onGoToPremios,
  onGoToRevisarDenuncias,
  onGoToHistorial,
  onBack,
}) {
  return (
    <ScrollView>
      <TouchableOpacity onPress={onGoToEstadisticas}>
        <Text>Estadísticas</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToMiembros}>
        <Text>Miembros</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToPremios}>
        <Text>Premios</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToRevisarDenuncias}>
        <Text>Revisar Denuncias</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToHistorial}>
        <Text>Historial</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
