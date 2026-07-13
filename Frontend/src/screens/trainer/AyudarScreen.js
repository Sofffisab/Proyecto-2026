import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Ayudar (Entrenador) - spec sección 12.
 * Lista de personas en el gym, ordenada por prioridad (backend).
 *
 * @param {function} [onOpenPerfil] - Abre el pop-up con datos del perfil clickeado.
 * @param {function} [onSeleccionarUsuario]
 * @param {function} [onBack]
 */
export default function AyudarScreen({ onOpenPerfil, onSeleccionarUsuario, onBack }) {
  return (
    <ScrollView>
      <Text>Personas en el gym</Text>

      <TouchableOpacity onPress={onOpenPerfil}>
        <Text>(Nombre y foto de perfil - clickeable)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onSeleccionarUsuario}>
        <Text>Seleccionar Usuario</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
