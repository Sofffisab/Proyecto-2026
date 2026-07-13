import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantallas de Personalizar Mínimamente el Perfil (Usuario) - spec sección 2.
 * Solo aparece la primera vez que el rol usuario se loguea.
 * Componentes estáticos, sin lógica de selección real todavía.
 *
 * @param {function} [onBack] - Botón de Volver (regla global).
 */
export default function OnboardingScreen({ onBack }) {
  const objetivoOptions = ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'];
  const nivelOptions = ['Opción 1', 'Opción 2', 'Opción 3'];
  const diasOptions = ['1', '2', '3', '4', '5', '6'];
  const tipoEntrenamientoOptions = ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'];

  return (
    <ScrollView>
      <View>
        <Text>Objetivo principal</Text>
        {objetivoOptions.map((opt) => (
          <TouchableOpacity key={opt}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View>
        <Text>Nivel actual</Text>
        {nivelOptions.map((opt) => (
          <TouchableOpacity key={opt}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View>
        <Text>Cuántos días entrenas por semana</Text>
        {diasOptions.map((opt) => (
          <TouchableOpacity key={opt}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View>
        <Text>Qué tipo de entrenamiento estás buscando</Text>
        {tipoEntrenamientoOptions.map((opt) => (
          <TouchableOpacity key={opt}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
