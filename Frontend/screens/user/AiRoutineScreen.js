// src/screens/user/AiRoutineScreen.js
//
// "Rutina personalizada con IA". The backend analyses the person's history and
// builds today's routine (POST /routines/ai/generate). This screen first asks
// for a PREVIEW (save: false, nothing is stored), optionally steered by a text
// like "día de piernas", and "Guardar rutina" saves it as today's routine and
// goes back to "Tu cronograma".

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { ROUTINE_OPTIONS } from '../../constants/generalRoutines';
import { toDateKey, resolveRoutineTitle } from '../../utils/schedule';
import { BackHeader, Footer, SparklesIcon, ArrowUpIcon, routineKitStyles } from '../../components/common/RoutineKit';
import { PrimaryButton, ChevronRightIcon } from '../../components/common/PopupKit';

const { colors } = globals;
const PLACEHOLDER_ROWS = 5;

/**
 * @param {function} [onBack]
 * @param {function} [onSaved] - called after the routine was saved
 */
export default function AiRoutineScreen({ onBack, onSaved }) {
  const { t } = useTranslation();
  const { generateWithAi, setRoutineOption, getExercise } = useRoutines();

  const todayKey = toDateKey(new Date());
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openRow, setOpenRow] = useState(null);
  const requestId = useRef(0);

  const generate = useCallback(
    async (text) => {
      const id = ++requestId.current;
      setLoading(true);
      setOpenRow(null);
      try {
        const data = await generateWithAi([todayKey], { prompt: text?.trim() || undefined, save: false });
        if (requestId.current === id) setPreview(data.preview);
      } catch {
        if (requestId.current === id) {
          setPreview(null);
          Alert.alert(t('user.routines.aiError'));
        }
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayKey, generateWithAi]
  );

  // First preview as soon as the screen opens (so "Guardar" works right away).
  useEffect(() => {
    generate('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!preview || saving) return;
    setSaving(true);
    try {
      await generateWithAi([todayKey], { prompt: prompt.trim() || undefined, save: true });
      setRoutineOption(ROUTINE_OPTIONS.MY_ROUTINES);
      onSaved && onSaved();
    } catch {
      Alert.alert(t('user.routines.aiError'));
    } finally {
      setSaving(false);
    }
  };

  const exercises = preview?.exercises ?? [];
  const rows = loading || !preview ? Array.from({ length: PLACEHOLDER_ROWS }) : exercises;

  return (
    <View style={routineKitStyles.screen}>
      <BackHeader
        title={t('user.routines.aiTitle')}
        subtitle={t('user.routines.aiSubtitle')}
        onBack={onBack}
        backLabel={t('user.routines.back')}
      />

      <ScrollView style={routineKitStyles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.inputRow}>
          <SparklesIcon size={18} />
          <TextInput
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder={t('user.routines.aiPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            maxLength={120}
            returnKeyType="send"
            onSubmitEditing={() => generate(prompt)}
          />
          <TouchableOpacity
            style={[styles.send, loading && styles.sendDisabled]}
            onPress={() => generate(prompt)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t('user.routines.aiGenerate')}
          >
            <ArrowUpIcon size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>{t('user.routines.aiPreview')}</Text>
          <Text style={styles.previewBody}>{t('user.routines.aiPreviewBody')}</Text>

          {preview && !loading ? (
            <View style={styles.metaRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>{resolveRoutineTitle(preview, t)}</Text>
              </View>
              <Text style={styles.meta}>
                {`${t('user.home.durationMinutes', { count: preview.estimatedMinutes })}  |  ${t('user.home.exercisesCount', { count: preview.exerciseCount })}`}
              </Text>
            </View>
          ) : (
            <View style={styles.metaRow}>{loading && <ActivityIndicator color={colors.primary} />}</View>
          )}

          <View style={styles.list}>
            {rows.map((item, index) => {
              const ex = item ? getExercise(item.id) : null;
              const isOpen = openRow === index;
              return (
                <TouchableOpacity
                  key={item?.id ?? `p${index}`}
                  style={[styles.row, index > 0 && styles.rowBorder]}
                  disabled={!item}
                  onPress={() => setOpenRow(isOpen ? null : index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowTop}>
                    <View style={styles.num}>
                      <Text style={styles.numText}>{index + 1}</Text>
                    </View>
                    <View style={styles.rowText}>
                      {item ? (
                        <>
                          <Text style={styles.rowName} numberOfLines={1}>{ex?.name ?? ''}</Text>
                          <Text style={styles.rowMeta}>{`${item.sets} × ${item.reps}`}</Text>
                        </>
                      ) : null}
                    </View>
                    {item ? (
                      <View style={isOpen ? styles.chevronOpen : null}>
                        <ChevronRightIcon size={16} color={colors.navInactive} />
                      </View>
                    ) : null}
                  </View>
                  {isOpen && ex?.description ? <Text style={styles.rowDesc}>{ex.description}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Footer>
        <PrimaryButton
          label={t('user.routines.aiSave')}
          onPress={handleSave}
          disabled={!preview || loading}
          loading={saving}
        />
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 8,
    height: 44,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 12, color: colors.text, paddingVertical: 0 },
  send: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.5 },

  previewCard: { backgroundColor: '#E6F0F1', borderRadius: 10, padding: 14, marginTop: 16, marginBottom: 12 },
  previewTitle: { fontSize: 13, fontWeight: '800', color: colors.primary },
  previewBody: { fontSize: 10, color: colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, minHeight: 24 },
  chip: { backgroundColor: colors.tealSoft, borderWidth: 1, borderColor: colors.primary, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, maxWidth: '62%' },
  chipText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  meta: { fontSize: 9, color: colors.textSecondary },

  list: { backgroundColor: '#FFFFFF', borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: colors.surfaceBorder },
  row: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 46, justifyContent: 'center' },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.surfaceBorder },
  rowTop: { flexDirection: 'row', alignItems: 'center' },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  numText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  rowText: { flex: 1 },
  rowName: { fontSize: 10, fontWeight: '800', color: colors.text },
  rowMeta: { fontSize: 8, color: colors.textSecondary, marginTop: 1 },
  rowDesc: { fontSize: 10, lineHeight: 14, color: colors.textSecondary, marginTop: 8, marginLeft: 34 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
});
