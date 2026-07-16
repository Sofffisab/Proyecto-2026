// src/screens/admin/FullHistoryScreen.js
//
// Full History Screen (Admin) - spec section 19.
// Shows everything that happens on every account, except what's filtered
// out for privacy.
//
// Backend wiring:
//   GET /analytics/admin/history?identified=true|false -> per-user rows,
//   always pseudonymized; identified=true additionally attaches real
//   name/email for users who did not withdraw analyticsConsent
//   (analyticsAdmin.api.js / insights.service.js#getFullHistoryAdmin).
//   The "Filtros de privacidad" toggle below simply flips that query flag.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as analyticsAdminApi from '../../api/services/analyticsAdmin.api';

/**
 * @param {function} [onBack]
 */
export default function FullHistoryScreen({ onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [includeIdentifiers, setIncludeIdentifiers] = useState(false);

  const load = useCallback(async (identified) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await analyticsAdminApi.getFullHistoryAdmin({ includeIdentifiers: identified });
      setRows(data ?? []);
    } catch (err) {
      setError(err.message || t('admin.fullHistory.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load(includeIdentifiers);
  }, [load, includeIdentifiers]);

  const rowLabel = (row) => {
    if (row.consented && (row.name || row.email)) {
      return row.name || row.email;
    }
    return row.pseudoId ?? row.id;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t('admin.fullHistory.title')}</Text>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setIncludeIdentifiers((v) => !v)}
      >
        <Text style={styles.filterButtonText}>
          {t('admin.fullHistory.privacyFilters')}: {includeIdentifiers
            ? t('admin.fullHistory.identified')
            : t('admin.fullHistory.pseudonymized')}
        </Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator color={globals.colors.primary} style={styles.spinner} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && rows.length === 0 && (
        <Text style={styles.mutedText}>{t('admin.fullHistory.noData')}</Text>
      )}

      {rows.map((row) => (
        <View key={row.pseudoId ?? row.id} style={styles.row}>
          <Text style={styles.rowTitle}>{rowLabel(row)}</Text>
          <Text style={styles.mutedText}>
            {t('admin.fullHistory.sessionsAndMinutes', { sessions: row.totalSessions, minutes: row.totalMinutes })}
          </Text>
          <Text style={styles.mutedText}>
            {t('admin.fullHistory.machineUsages', { count: row.machineUsages?.length ?? 0 })}
          </Text>
        </View>
      ))}

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>{t('admin.fullHistory.back')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: globals.colors.background },
  content: { padding: globals.spacing.md },
  title: {
    fontSize: globals.fontSize.lg,
    fontWeight: 'bold',
    color: globals.colors.text,
    marginBottom: globals.spacing.md,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: globals.colors.border,
    borderRadius: globals.radius.md,
    padding: globals.spacing.sm,
    marginBottom: globals.spacing.md,
    alignSelf: 'flex-start',
  },
  filterButtonText: { color: globals.colors.text, fontSize: globals.fontSize.sm },
  spinner: { marginBottom: globals.spacing.md },
  row: {
    paddingVertical: globals.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.border,
  },
  rowTitle: { fontSize: globals.fontSize.md, color: globals.colors.text },
  mutedText: { fontSize: globals.fontSize.sm, color: globals.colors.textMuted },
  errorText: {
    color: globals.colors.danger,
    fontSize: globals.fontSize.sm,
    marginBottom: globals.spacing.sm,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
