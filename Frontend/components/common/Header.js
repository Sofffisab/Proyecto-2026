// src/components/common/Header.js

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

/**
 * Reusable top header bar (Figma style: white bar, bold centered title,
 * back chevron on the left like "Tu cronograma" / "Editar perfil").
 *
 * @param {string} pageTitle  - Main heading displayed in the header.
 * @param {string} [subtitle] - Optional secondary line below the title.
 * @param {function} [onBack] - If provided, renders the "<" chevron on the
 *   left. Screens that don't pass it just get an empty slot so the title
 *   stays perfectly centered.
 * @param {function} [onPressNotifications] - If provided, renders a bell
 *   button in the top-right corner.
 * @param {number} [unreadCount] - Badge count shown next to the bell.
 */
const Header = ({ pageTitle, subtitle, onBack, onPressNotifications, unreadCount }) => (
  <View style={styles.header}>
    <View style={styles.side}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.iconButton} hitSlop={10}>
          <Image
            source={require('../../assets/basil_caret-left-outline.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>
      )}
    </View>

    <View style={styles.headerTextBlock}>
      <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
      {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
    </View>

    <View style={[styles.side, styles.sideRight]}>
      {onPressNotifications && (
        <TouchableOpacity onPress={onPressNotifications} style={styles.iconButton}>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: globals.spacing.lg,
    paddingBottom: globals.spacing.md,
    paddingHorizontal: globals.spacing.md,
    backgroundColor: globals.colors.surface,
  },
  side: {
    width: 40,
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  iconButton: {
    padding: globals.spacing.xs,
  },
  backIcon: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  headerTextBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: globals.colors.text,
  },
  headerSubtitle: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textSecondary,
    marginTop: globals.spacing.xs,
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
