import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Denuncias (Usuario) - spec sección 3.
 * Antes implementada como pop-up; se convierte a pantalla completa por
 * consistencia con la Pantalla Denuncias del Entrenador (sección 11) y
 * porque una denuncia tiene consecuencias reales (penalizaciones progresivas,
 * alertas al Admin), lo que amerita el espacio y la intención de una
 * pantalla dedicada en vez de un modal.
 *
 * @param {function} [onEnviar] - Manda la denuncia directamente a revisión.
 * @param {function} [onBack] - Botón de Volver.
 */
export default function DenunciasScreen({ onEnviar, onBack }) {
  return (
    <ScrollView>
      <Text>Objetivo de la denuncia</Text>
      {/* Selector: lista de entrenadores, personas del gym o elementos de la app (puntos, logros, etc.) */}
      <TouchableOpacity>
        <Text>Seleccionar objetivo</Text>
      </TouchableOpacity>

      <Text>Motivo</Text>
      <TextInput placeholder="¿Por qué?" />

      <TouchableOpacity onPress={onEnviar}>
        <Text>Enviar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
