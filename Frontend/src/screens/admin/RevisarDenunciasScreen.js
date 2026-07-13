import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

/**
 * Pantalla Revisar Denuncias (Admin) - spec sección 18.
 *
 * @param {function} [onBack]
 */
export default function RevisarDenunciasScreen({ onBack }) {
  return (
    <ScrollView>
      <View>
        <Text>Denuncias hechas y aprobadas</Text>
        <Text>(Lista estática - permite visualizar y decidir si se eliminan)</Text>
      </View>

      <View>
        <Text>Peticiones de revisión</Text>
        <Text>(Lista estática - verificar si una denuncia estuvo mal aplicada)</Text>
      </View>

      <View>
        <Text>Comportamiento sospechoso</Text>
        <Text>(Lista estática - demasiadas denuncias recibidas/hechas)</Text>
      </View>

      <TouchableOpacity onPress={onBack}>
        <Text>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
