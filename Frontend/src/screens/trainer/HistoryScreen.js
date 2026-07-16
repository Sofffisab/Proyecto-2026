// src/screens/trainer/HistoryScreen.js
//
// History Screen (Trainer) - spec section 10:
// "Muestra a quién ayudaron, cuándo lo hicieron, cuándo fueron, etc."
//
// Backed by GET /history/trainer-assistance (history.api.js), which maps
// to history.service.js#getTrainerAssistanceHistory (controller/service
// already existed; the route itself was missing from routes/index.js and
// has been added — see routes/index.js "HISTORY ROUTES" section).
//
// Note: the Backend's Assistance model has no trainerRating field (a
// pre-existing data gap flagged in history.api.js), so `rating` may come
// back null/undefined for every entry — handled gracefully below rather
// than assuming it will be populated.

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import { useTranslation } from '../../i18n/I18nContext';
import * as historyApi from '../../api/services/history.api';

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

/**
 * @param {function} [onBack]
 */
export default function TrainerHistoryScreen({ onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [entries, setEntries] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await historyApi.getTrainerAssistanceHistory();
      setEntries(res.data ?? []);
    } catch {
      setError(true);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <Header pageTitle={t('trainer.history.title')} />

      <ScrollView style={styles.content}>
        {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}

        {!loading && error && <Text style={styles.errorText}>{t('trainer.history.loadError')}</Text>}

        {!loading && !error && entries.length === 0 && (
          <Text style={styles.emptyText}>{t('trainer.history.empty')}</Text>
        )}

        {!loading &&
          !error &&
          entries.map((entry) => (
            <View key={entry.assistanceId} style={styles.row}>
              <Text style={styles.rowPrimary}>{entry.studentName}</Text>
              <Text style={styles.rowSecondary}>
                {t('trainer.history.assistedOn', { date: formatDateTime(entry.date) ?? '—' })}
              </Text>
              {entry.machineName && (
                <Text style={styles.rowDetail}>
                  {t('trainer.history.machineLabel', { machine: entry.machineName })}
                </Text>
              )}
              <Text style={styles.rowDetail}>
                {entry.rating != null
                  ? t('trainer.history.ratingLabel', { rating: entry.rating })
                  : t('trainer.history.noRating')}
              </Text>
            </View>
          ))}

        <Text style={styles.backLink} onPress={onBack}>{t('trainer.history.back')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    flex: 1,
    padding: globals.spacing.md,
  },
  spinner: {
    marginTop: globals.spacing.xl,
  },
  row: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
  },
  rowPrimary: {
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    fontWeight: '600',
  },
  rowSecondary: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
  },
  rowDetail: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    marginTop: globals.spacing.xs,
  },
  emptyText: {
    fontSize: globals.fontSize.sm,
    color: globals.colors.textMuted,
    textAlign: 'center',
    marginTop: globals.spacing.xl,
  },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.md,
    textAlign: 'center',
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
