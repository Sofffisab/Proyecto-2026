// src/components/user/AchievementTile.js
//
// "Tus logros" tile (Logros y metas): 100x130 white card with the badge icon,
// its name and a short caption. Data = one unlocked achievement from
// GET /gamification/badges ({ achievement: { name, description, category } }).

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

// Badge icon by achievement category (Backend AchievementCategory).
export const ACHIEVEMENT_ICONS = {
  CONSISTENCY: require('../../src/assets/Vector (7).png'),
  SOCIAL: require('../../src/assets/a.png'),
  MACHINE: require('../../src/assets/circum_dumbbell.png'),
  POINTS: require('../../src/assets/Vector (8).png'),
};

/**
 * @param {string} category - AchievementCategory
 * @param {string} name
 * @param {string} [description]
 */
export default function AchievementTile({ category, name, description }) {
  return (
    <View style={styles.tile}>
      <Image source={ACHIEVEMENT_ICONS[category] ?? ACHIEVEMENT_ICONS.POINTS} style={styles.icon} resizeMode="contain" />
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      {Boolean(description) && <Text style={styles.caption} numberOfLines={3}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 100,
    height: 130,
    borderRadius: 9,
    backgroundColor: globals.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    ...globals.shadow.card,
  },
  icon: { width: 39, height: 36, marginBottom: 8 },
  name: { fontSize: 13, fontWeight: '700', color: globals.colors.text, textAlign: 'center' },
  caption: { fontSize: 9, color: globals.colors.captionGrey, textAlign: 'center', marginTop: 4, lineHeight: 12 },
});
