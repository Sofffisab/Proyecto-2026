import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Principal Usuario - spec sección 3.
 * Componentes estáticos, sin lógica de escaneo/puntos todavía.
 *
 * @param {function} [onGoToHistoriales]
 * @param {function} [onGoToRutinas]
 * @param {function} [onGoToLogrosMetas]
 * @param {function} [onOpenDenuncias] - abre pop-up Denuncias
 * @param {function} [onPedirAyuda]
 * @param {function} [onGoToConfiguracion]
 * @param {function} [onGoToWrapped]
 * @param {function} [onLogout] - abre pop-up "estás seguro?"
 * @param {function} [onBack]
 */
export default function PrincipalScreen({
  onGoToHistoriales,
  onGoToRutinas,
  onGoToLogrosMetas,
  onOpenDenuncias,
  onPedirAyuda,
  onGoToConfiguracion,
  onGoToWrapped,
  onLogout,
  onBack,
}) {
  return (
    <ScrollView>
      <View>
        <Text>Puntos acumulados: 0</Text>
      </View>

      <TouchableOpacity>
        <Text>Escanear QR (Cámara)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToHistoriales}>
        <Text>Historiales</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToRutinas}>
        <Text>Rutinas</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToLogrosMetas}>
        <Text>Logros y Metas</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onOpenDenuncias}>
        <Text>Denuncias</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onPedirAyuda}>
        <Text>Pedir Ayuda</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToConfiguracion}>
        <Text>Configuración y personalizaciones</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onGoToWrapped}>
        <Text>Wrapped del año</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onLogout}>
        <Text>Cerrar sesión / Cambiar de cuenta</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
