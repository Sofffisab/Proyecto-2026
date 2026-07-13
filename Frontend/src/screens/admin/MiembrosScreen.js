import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Miembros (Admin) - spec sección 15.
 *
 * @param {function} [onCrearSesion]
 * @param {function} [onDesactivarCuenta]
 * @param {function} [onActivarCuenta]
 * @param {function} [onBack]
 */
export default function MiembrosScreen({
  onCrearSesion,
  onDesactivarCuenta,
  onActivarCuenta,
  onBack,
}) {
  return (
    <ScrollView>
      <Text>Crear sesión nueva</Text>
      <TextInput placeholder="Mail de la persona" keyboardType="email-address" />
      <TouchableOpacity onPress={onCrearSesion}>
        <Text>Crear sesión nueva</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onDesactivarCuenta}>
        <Text>Desactivar cuenta</Text>
      </TouchableOpacity>

      <View>
        <Text>Visor de sesiones</Text>
        <Text>(Lista estática de sesiones: rol, nombre, mail, datos, antigüedad, estado, puntaje si es entrenador)</Text>
      </View>

      <TouchableOpacity onPress={onActivarCuenta}>
        <Text>Activar cuenta</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
