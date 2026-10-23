// src/screens/user/ScheduleScreen.js
//
// Weekly schedule ("Tu cronograma", screen 2). One row per day of the week
// (Monday -> Sunday); days with no routine show as "Empty". Tapping a row
// opens that day's routine screen.
//
// Extra: the calendar icon in the header toggles a selection mode where any
// number of days (all / none / some) can be filled with the personalized AI
// routine (static generator for now, see utils/personalizedRoutine.js).

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { capitalize, estimateMinutes, getDateParts, getWeekDays, getWeekStart, toDateKey } from '../../utils/schedule';

/**
 * @param {function} [onBack]
 * @param {function} [onGoToRoutineDay] - (dateKey) => void
 */
export default function ScheduleScreen({ onBack, onGoToRoutineDay }) {
  const { t, language } = useTranslation();
  const { getDay, generateWithAi } = useRoutines();

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const weekDays = getWeekDays(getWeekStart(new Date(), weekOffset));
  const weekKeys = weekDays.map(toDateKey);
  const first = getDateParts(weekDays[0], language);
  const last = getDateParts(weekDays[6], language);
  const weekLabel =
    first.month === last.month
      ? t('user.routines.weekRangeSameMonth', { start: first.day, end: last.day, month: first.month })
      : t('user.routines.weekRangeCrossMonth', { start: first.day, startMonth: first.month, end: last.day, endMonth: last.month });

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedKeys([]);
  };

  const toggleKey = (dateKey) => {
    setSelectedKeys((prev) => (prev.includes(dateKey) ? prev.filter((k) => k !== dateKey) : [...prev, dateKey]));
  };

  const handleGenerateWithAi = () => {
    generateWithAi(selectedKeys, t('user.routines.aiRoutineTitle'));
    toggleSelectionMode();
  };

  return (
    <View style={styles.container}>
      <Header
        pageTitle={t('user.routines.scheduleTitle')}
        onBack={onBack}
        rightIcon={require('../../assets/Group.png')}
        onPressRight={toggleSelectionMode}
      />

      <View style={styles.weekRow}>
        <TouchableOpacity onPress={() => setWeekOffset((prev) => prev - 1)} hitSlop={10}>
          <Image source={require('../../assets/boton.png')} style={styles.weekArrow} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        <TouchableOpacity onPress={() => setWeekOffset((prev) => prev + 1)} hitSlop={10}>
          <Image source={require('../../assets/boto.png')} style={styles.weekArrow} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        {weekDays.map((date, i) => {
          const dateKey = weekKeys[i];
          const entry = getDay(dateKey);
          const exercises = entry?.exercises ?? [];
          const parts = getDateParts(date, language);
          const hasRoutine = entry != null;
          const selected = selectedKeys.includes(dateKey);

          return (
            <TouchableOpacity
              key={dateKey}
              style={[styles.dayRow, selected && styles.dayRowSelected]}
              onPress={() => (selectionMode ? toggleKey(dateKey) : onGoToRoutineDay && onGoToRoutineDay(dateKey))}
              activeOpacity={0.8}
            >
              {selectionMode && (
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
              )}
              <View style={styles.dayCol}>
                <Text style={styles.dayName}>{capitalize(parts.weekday)}</Text>
                <Text style={styles.dayDate}>{t('user.routines.dayMonth', parts)}</Text>
              </View>
              <View style={[styles.dot, hasRoutine && styles.dotActive]} />
              <View style={styles.infoCol}>
                <Text style={styles.dayTitle} numberOfLines={1}>
                  {hasRoutine ? entry.title || t('user.routines.defaultDayTitle') : t('user.routines.emptyRoutine')}
                </Text>
                <Text style={styles.dayMeta}>
                  {exercises.length > 0
                    ? `${t('user.home.durationMinutes', { count: estimateMinutes(exercises) })}  ·  ${t('user.home.exercisesCount', { count: exercises.length })}`
                    : '-'}
                </Text>
              </View>
              <Image source={require('../../assets/derecha.png')} style={styles.chevron} />
            </TouchableOpacity>
          );
        })}

        <Text style={styles.footnote}>{t('user.routines.scheduleFootnote')}</Text>
      </ScrollView>

      {selectionMode && (
        <View style={styles.selectionBar}>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={() => setSelectedKeys(weekKeys)}>
              <Text style={styles.selectionLink}>{t('user.routines.selectAll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedKeys([])}>
              <Text style={styles.selectionLink}>{t('user.routines.selectNone')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.aiButton, selectedKeys.length === 0 && styles.aiButtonDisabled]}
            onPress={handleGenerateWithAi}
            disabled={selectedKeys.length === 0}
          >
            <Text style={styles.aiButtonText}>{t('user.routines.generateWithAi')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { flex: 1 },
  contentInner: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: globals.spacing.lg },

  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  weekArrow: { width: 18, height: 18, resizeMode: 'contain' },
  weekLabel: { fontSize: 16, fontWeight: '700', color: globals.colors.text },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    backgroundColor: globals.colors.surface,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    ...globals.shadow.card,
  },
  dayRowSelected: { borderColor: globals.colors.primary },
  dayCol: { width: 64 },
  dayName: { fontSize: 10, color: globals.colors.textSecondary },
  dayDate: { fontSize: 10, color: globals.colors.textSecondary, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9A9A9A', marginHorizontal: 12 },
  dotActive: { backgroundColor: globals.colors.primary },
  infoCol: { flex: 1 },
  dayTitle: { fontSize: 13, fontWeight: '700', color: globals.colors.text },
  dayMeta: { fontSize: 10, color: globals.colors.textSecondary, marginTop: 3 },
  chevron: { width: 18, height: 18, resizeMode: 'contain' },
  footnote: { fontSize: 10, color: globals.colors.textSecondary, marginTop: 4, paddingHorizontal: 4 },

  // selection mode (AI extra)
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CFCFCF',
    backgroundColor: globals.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxSelected: { backgroundColor: globals.colors.primary, borderColor: globals.colors.primary },
  checkboxCheck: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  selectionBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: globals.colors.surface,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
  },
  selectionActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  selectionLink: { fontSize: 13, fontWeight: '600', color: globals.colors.primary },
  aiButton: {
    backgroundColor: globals.colors.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    ...globals.shadow.button,
  },
  aiButtonDisabled: { opacity: 0.5 },
  aiButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
