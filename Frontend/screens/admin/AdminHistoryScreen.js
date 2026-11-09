// Admin "Historial": the record of what happens in the app — what admins and
// trainers did (prize stock, accounts, reports, conflicts, routines...) and what
// members did (gym entries/exits, machines, help, social). Nothing in it can be
// deleted. Whatever a member marked as private (analytics consent withdrawn) is
// left out by the Backend. Filter chips narrow it by who did the action.
// Data: GET /admin/history (cursor paginated).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { formatDateTime } from '../../utils/format';
import * as adminApi from '../../apiClient/services/admin.api';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import Card from '../../components/admin/Card';
import Chips from '../../components/admin/Chips';
import StatusPill from '../../components/admin/StatusPill';
import AdminButton from '../../components/admin/AdminButton';
import StateView from '../../components/common/StateView';

const PAGE = 30;

export default function AdminHistoryScreen() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const latest = useRef(0);

  const fetchPage = useCallback(
    async (before) => {
      const id = ++latest.current;
      before ? setLoadingMore(true) : setLoading(true);
      setError(null);
      try {
        const { data } = await adminApi.getHistory({ role: filter === 'all' ? undefined : filter, before, limit: PAGE });
        if (id !== latest.current) return;
        setRows((prev) => (before ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch (err) {
        if (id === latest.current) setError(err.message);
      } finally {
        if (id === latest.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filter]
  );

  useEffect(() => {
    fetchPage(null);
  }, [fetchPage]);

  const options = [
    { key: 'all', label: t('admin.history.filterAll') },
    { key: 'admin', label: t('admin.history.filterAdmins') },
    { key: 'trainer', label: t('admin.history.filterTrainers') },
    { key: 'user', label: t('admin.history.filterUsers') },
  ];

  // "Ana helped someone" style sentence for one row; unknown codes still read as something.
  const describe = (row) => {
    const key = `admin.history.actions.${row.action}`;
    const params = Object.fromEntries(Object.entries(row.params ?? {}).map(([k, v]) => [k, v ?? '–']));
    if (params.resolution) params.resolution = t(`admin.history.resolutions.${params.resolution}`);
    if (params.target) params.target = t(`admin.history.targets.${params.target}`);
    if (params.role) params.role = t(`admin.roles.${String(params.role).toLowerCase()}`);
    const text = t(key, params);
    return text === key ? t('admin.history.actions.UNKNOWN', { action: row.action }) : text;
  };

  return (
    <ScreenBody title={t('admin.history.title')} subtitle={t('admin.history.subtitle')}>
      <Chips options={options} value={filter} onChange={setFilter} />
      <Text style={styles.privacy}>{t('admin.history.privacyNote')}</Text>

      <StateView
        loading={loading}
        error={error && rows.length === 0 ? error : null}
        onRetry={() => fetchPage(null)}
        empty={rows.length === 0}
        emptyText={t('admin.history.empty')}
      >
        {rows.map((r) => (
          <Card key={r.id}>
            <View style={styles.head}>
              <Avatar name={r.actor.name} size={40} />
              <View style={styles.headTexts}>
                <Text style={styles.name} numberOfLines={1}>{r.actor.name}</Text>
                <Text style={styles.caption}>{formatDateTime(r.occurredAt)}</Text>
              </View>
              <StatusPill label={t(`admin.roles.${r.actor.role.toLowerCase()}`)} tone={r.actor.role === 'USER' ? 'grey' : 'teal'} />
            </View>
            <Text style={styles.action}>{describe(r)}</Text>
          </Card>
        ))}
        {!!error && rows.length > 0 && <Text style={styles.error}>{error}</Text>}
        {cursor && (
          <AdminButton
            label={loadingMore ? t('admin.history.loading') : t('admin.history.loadMore')}
            onPress={() => fetchPage(cursor)}
            disabled={loadingMore}
          />
        )}
      </StateView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  privacy: { marginBottom: globals.spacing.md, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
  error: { color: globals.colors.danger, marginBottom: globals.spacing.sm, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginHorizontal: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  action: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    fontSize: globals.fontSize.md,
    color: globals.colors.text,
    lineHeight: 21,
  },
});
