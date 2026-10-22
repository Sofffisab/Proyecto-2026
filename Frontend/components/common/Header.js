// src/components/common/Header.js

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Reusable top header bar.
 *
 * @param {string} pageTitle  - Main heading displayed in the header.
 * @param {string} [subtitle] - Optional secondary line below the title.
 * @param {function} [onPressNotifications] - If provided, renders a bell
 *   button in the top-right corner (screens that don't pass this keep the
 *   exact same header as before).
 * @param {number} [unreadCount] - Badge count shown next to the bell.
 */
const Header = ({ pageTitle, subtitle, onPressNotifications, unreadCount }) => (
  <View style={styles.header}>
    <View style={styles.headerRow}>
      <View style={styles.headerTextBlock}>
        <Text style={styles.headerTitle}>{pageTitle}</Text>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>

      {onPressNotifications && (
        <TouchableOpacity onPress={onPressNotifications} style={styles.bellButton}>
          <Text style={styles.bellIcon}>🔔</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    width: '100%',
    paddingVertical: globals.spacing.md,
    paddingHorizontal: globals.spacing.lg,
    backgroundColor: globals.colors.primary,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextBlock: {
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: globals.fontSize.xl,
    fontWeight: 'bold',
    color: globals.colors.secondary,
  },
  headerSubtitle: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textLight,
    marginTop: globals.spacing.xs,
  },
  bellButton: {
    padding: globals.spacing.xs,
  },
  bellIcon: {
    fontSize: globals.fontSize.lg,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: globals.colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default Header;
