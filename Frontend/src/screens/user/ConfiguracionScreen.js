import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Configuración y personalizaciones (Usuario) - spec sección 7.
 * Si es la primera vez, el sistema redirige aquí y no permite salir hasta completar todo.
 *
 * @param {function} [onBack]
 */
export default function ConfiguracionScreen({ onBack }) {
  return (
    <ScrollView>
      <Text>Datos de sesión</Text>

      <Text>Mail (no editable)</Text>
      <TextInput editable={false} />

      <Text>Temas médicos</Text>
      <TextInput placeholder="Temas médicos" />

      <Text>Fecha de nacimiento</Text>
      <TextInput placeholder="Fecha de nacimiento" />

      <Text>Dirección exacta</Text>
      <TextInput placeholder="Dirección exacta" />

      <Text>Preferencias</Text>
      <TouchableOpacity>
        <Text>No recibir ayuda del entrenador</Text>
      </TouchableOpacity>
      <TouchableOpacity>
        <Text>No usar la app para máquinas</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
