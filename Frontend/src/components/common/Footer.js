import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Footer de navegación reutilizable.
 * Versión estática: no depende de expo-router ni de AuthContext todavía
 * (no hay conexión a backend en esta etapa del proyecto). La navegación
 * y el logout se resuelven vía callbacks recibidos por props, igual que
 * en el resto de las pantallas ya corregidas.
 *
 * @param {function} [onNavigateHome]
 * @param {function} [onNavigateSearch]
 * @param {function} [onNavigateScan]
 * @param {function} [onNavigateProfile]
 * @param {function} [onLogout]
 */
function Footer({ onNavigateHome, onNavigateSearch, onNavigateScan, onNavigateProfile, onLogout }) {
  const navItems = [
    { label: 'Home', onPress: onNavigateHome },
    { label: 'Search', onPress: onNavigateSearch },
    { label: 'Scan', onPress: onNavigateScan },
    { label: 'Profile', onPress: onNavigateProfile },
  ];

  return (
    <View style={styles.footer}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.label}
          onPress={item.onPress}
          style={styles.navItem}
        >
          <Text style={styles.navLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutLabel}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: globals.colors.primary,
    paddingVertical: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.border,
    gap: globals.spacing.sm,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: globals.spacing.sm,
  },
  navLabel: {
    color: globals.colors.background,
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
  },
  logoutButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: globals.spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: globals.colors.background,
  },
  logoutLabel: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    fontWeight: '600',
  },
});

export default Footer;