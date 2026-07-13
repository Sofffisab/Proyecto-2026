import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

/**
 * Pop-up de Denuncias (Usuario) - spec sección 3.
 *
 * @param {function} [onEnviar] - Manda la denuncia directamente a revisión.
 * @param {function} [onBack] - Botón de Volver.
 * @param {function} [onClose] - Botón de Cerrar.
 */
export default function DenunciasPopup({ onEnviar, onBack, onClose }) {
  return (
    <View>
      <Text>Objetivo de la denuncia</Text>
      {/* Selector: lista de entrenadores, personas del gym o elementos de la app */}
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

      <TouchableOpacity onPress={onClose}>
        <Text>Cerrar</Text>
      </TouchableOpacity>
    </View>
  );
}
