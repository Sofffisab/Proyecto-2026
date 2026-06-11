import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import globals from '../../styles/globals';

function Footer() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navItems = [
    { label: 'Home', route: 'index' },
    { label: 'Search', route: 'index' },
    { label: 'Scan', route: 'index' },
    { label: 'Profile', route: 'profile' },
  ];

  return (
    <View style={styles.footer}>
      {navItems.map((item) => (
        <TouchableOpacity
          key={item.label}
          onPress={() => router.push(item.route)}
          style={styles.navItem}
        >
          <Text style={styles.navLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}
      
      <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
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