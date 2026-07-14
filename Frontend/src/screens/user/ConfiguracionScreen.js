import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Button from '../../components/common/Button';

/**
 * Pantalla Configuración y personalizaciones (Usuario) - spec sección 7.
 * Si es la primera vez, el sistema redirige aquí y no permite salir hasta
 * completar todo. Campos obligatorios (menos el mail, que no se edita):
 * temas médicos, fecha de nacimiento, dirección exacta, etc.
 * Cada fila es un acordeón: se toca la fila para revelar el input.
 *
 * @param {string}   [email] - Mail de sesión, no editable.
 * @param {function} [onSave] - Guarda los datos en la DB.
 * @param {function} [onBack]
 */
const FIELDS = [
  { key: 'temasMedicos', label: 'Temas médicos' },
  { key: 'fechaNacimiento', label: 'Fecha de nacimiento' },
  { key: 'direccionExacta', label: 'Dirección exacta' },
];

const PREFERENCIAS = [
  { key: 'noAyudaEntrenador', label: 'No recibir ayuda del entrenador' },
  { key: 'noUsarAppMaquinas', label: 'No usar la app para máquinas (sí para entrada y salida)' },
];

export default function ConfiguracionScreen({ email = '', onSave, onBack }) {
  const [openField, setOpenField] = useState(null);
  const [values, setValues] = useState({});
  const [preferencias, setPreferencias] = useState({});

  const toggle = (key) =>
    setOpenField((prev) => (prev === key ? null : key));

  const handleChange = (key, text) =>
    setValues((prev) => ({ ...prev, [key]: text }));

  const togglePreferencia = (key) =>
    setPreferencias((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Header pageTitle="Configuración" subtitle="Datos de sesión y personalizaciones" />

      {/* Mail: no editable */}
      <View style={styles.fieldBlock}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>Mail</Text>
        </View>
        <View style={styles.inputWrapper}>
          <TextInput style={styles.input} value={email} editable={false} />
        </View>
      </View>

      {/* Campos obligatorios en formato acordeón */}
      {FIELDS.map(({ key, label }) => {
        const isOpen = openField === key;
        return (
          <View key={key} style={styles.fieldBlock}>
            <TouchableOpacity
              style={styles.fieldRow}
              onPress={() => toggle(key)}
              activeOpacity={0.8}
            >
              <Text style={styles.fieldLabel}>{label}</Text>
              <Text style={[styles.fieldArrow, isOpen && styles.fieldArrowOpen]}>{'>'}</Text>
            </TouchableOpacity>

            {isOpen && (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={`Ingresá ${label.toLowerCase()}...`}
                  placeholderTextColor={globals.colors.textMuted}
                  value={values[key] ?? ''}
                  onChangeText={(text) => handleChange(key, text)}
                />
              </View>
            )}
          </View>
        );
      })}

      {/* Preferencias */}
      <Text style={styles.sectionTitle}>Preferencias</Text>
      {PREFERENCIAS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={styles.preferenciaRow}
          onPress={() => togglePreferencia(key)}
        >
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.checkbox}>{preferencias[key] ? '☑' : '☐'}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.buttonGroup}>
        <Button label="Guardar" onPress={onSave} />
        <Button label="Volver" onPress={onBack} variant="secondary" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.backgroundAlt,
  },
  content: {
    paddingBottom: globals.spacing.xl,
  },
  sectionTitle: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    paddingHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
    marginBottom: globals.spacing.xs,
  },
  fieldBlock: {
    backgroundColor: globals.colors.secondary,
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.xs,
    borderRadius: globals.radius.md,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.md,
  },
  fieldLabel: {
    flex: 1,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
  },
  fieldArrow: {
    fontSize: globals.fontSize.xl,
    color: globals.colors.textMuted,
  },
  fieldArrowOpen: {
    transform: [{ rotate: '90deg' }],
  },
  inputWrapper: {
    paddingHorizontal: globals.spacing.md,
    paddingBottom: globals.spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    backgroundColor: globals.colors.background,
  },
  preferenciaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: globals.colors.secondary,
    marginHorizontal: globals.spacing.md,
    marginTop: globals.spacing.xs,
    paddingHorizontal: globals.spacing.md,
    paddingVertical: globals.spacing.md,
    borderRadius: globals.radius.md,
  },
  checkbox: {
    fontSize: globals.fontSize.lg,
    color: globals.colors.primary,
  },
  buttonGroup: {
    paddingHorizontal: globals.spacing.md,
    marginTop: globals.spacing.lg,
  },
});
