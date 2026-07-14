import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Reusable navigation footer.
 * Static version: doesn't depend on expo-router or AuthContext yet
 * (no backend connection at this stage of the project). Navigation
 * and logout are resolved via callbacks received as props, same as
 * the rest of the already-updated screens.
 *
 * @param {function} [onNavigateHome]
 * @param {function} [onNavigateSearch]
 * @param {function} [onNavigateScan]
 * @param {function} [onNavigateProfile]
 * @param {function} [onLogout]
 */
function Footer({ onNavigateHome, onNavigateSearch, onNavigateScan, onNavigateProfile, onLogout }) {
  const { t } = useTranslation();

  const navItems = [
    { key: 'home', label: t('footer.home'), onPress: onNavigateHome },
    { key: 'search', label: t('footer.search'), onPress: onNavigateSearch },
    { key: 'scan', label: t('footer.scan'), onPress: onNavigateScan },
    { key: 'profile', label: t('footer.profile'), onPress: onNavigateProfile },
  ];

  return (
    <View style={styles.footer}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.key}
          onPress={item.onPress}
          style={styles.navItem}
        >
          <Text style={styles.navLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
        <Text style={styles.logoutLabel}>{t('footer.logout')}</Text>
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
