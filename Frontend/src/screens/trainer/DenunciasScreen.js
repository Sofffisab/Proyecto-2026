import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Denuncias (Entrenador) - spec sección 11.
 *
 * @param {function} [onEnviar]
 * @param {function} [onBack]
 */
export default function TrainerDenunciasScreen({ onEnviar, onBack }) {
  return (
    <ScrollView>
      <Text>Persona a denunciar</Text>
      {/* Selector: lista de entrenadores y personas del gym */}
      <TouchableOpacity>
        <Text>Seleccionar persona</Text>
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
