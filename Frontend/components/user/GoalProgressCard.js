// src/components/user/GoalProgressCard.js
//
// "Tus metas" card (Logros y metas): round icon, title, "3 de 3 ..." line,
// progress bar and the percentage on the right. Data = one goal from GET /goals
// ({ type, subType, currentValue, targetValue, unit }).

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import globals from '../../styles/globals';

// Icon by goal type (Backend GoalType): body/strength goals get the dumbbell,
// the rest the flame.
const DUMBBELL = require('../../src/assets/circum_dumbbell.png');
const FLAME = require('../../src/assets/a.png');
const DUMBBELL_TYPES = ['WEIGHT', 'MUSCLE', 'FAT', 'STRENGTH'];

/**
 * @param {string} type
 * @param {string} title
 * @param {string} progressLine - e.g. "3 de 3 entrenamientos"
 * @param {number} percent - 0..100
 * @param {string} percentLabel - "100%"
 * @param {string} statusLabel - "Completada" / "En progreso"
 */
export default function GoalProgressCard({ type, title, progressLine, percent, percentLabel, statusLabel }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Image source={DUMBBELL_TYPES.includes(type) ? DUMBBELL : FLAME} style={styles.icon} resizeMode="contain" />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <Text style={styles.line} numberOfLines={1}>{progressLine}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${percent}%` }]} />
        </View>
      </View>

      <View style={styles.percentCol}>
        <Text style={styles.percent}>{percentLabel}</Text>
        <Text style={styles.status}>{statusLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 410,
    minHeight: 88,
    padding: 10,
    borderWidth: 1,
    borderColor: globals.colors.goalBorder,
    borderRadius: 17,
    backgroundColor: globals.colors.surface,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: globals.colors.iconCircle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  icon: { width: 25, height: 25 },
  content: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', color: '#111111', marginBottom: 5 },
  line: { fontSize: 12, color: '#999999', marginBottom: 5 },
  track: { width: '100%', height: 6, borderRadius: 10, backgroundColor: globals.colors.progressTrack, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 10, backgroundColor: globals.colors.primary },
  percentCol: { minWidth: 65, alignItems: 'flex-end', marginLeft: 13 },
  percent: { fontSize: 15, fontWeight: '700', color: globals.colors.primary, marginBottom: 2 },
  status: { fontSize: 11, color: globals.colors.primary },
});
