// Trainer "Historial": who they helped, when, on which machine, for how long
// and how the member rated it. Data: GET /history/trainer-assistance.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import useLoad from '../../hooks/useLoad';
import { formatDateTime } from '../../utils/format';
import * as trainerApi from '../../apiClient/services/trainer.api';
import StateView from '../../components/common/StateView';

const loadHistory = async () => (await trainerApi.getHelpHistory()).data ?? [];

export default function TrainerHistoryScreen() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useLoad(loadHistory);
  const rows = data ?? [];

  return (
    <ScreenBody title={t('trainer.history.title')} subtitle={t('trainer.history.subtitle')}>
      <StateView loading={loading} error={error} onRetry={reload} empty={rows.length === 0} emptyText={t('trainer.history.empty')}>
        {rows.map((h) => (
          <View key={h.assistanceId} style={styles.card}>
            <View style={styles.head}>
              <Avatar name={h.studentName} size={44} />
              <View style={styles.headTexts}>
                <Text style={styles.name} numberOfLines={1}>{h.studentName}</Text>
                <Text style={styles.caption}>{t('trainer.history.assistedOn', { date: formatDateTime(h.date) })}</Text>
              </View>
            </View>
            <View style={styles.details}>
              <Text style={[styles.detail, !h.machineName && styles.muted]}>
                {h.machineName ? t('trainer.history.machineLabel', { machine: h.machineName }) : t('trainer.history.noMachine')}
              </Text>
              {h.minutes != null && <Text style={styles.detail}>{t('trainer.history.durationLabel', { minutes: h.minutes })}</Text>}
              <Text style={[styles.detail, h.rating == null && styles.muted]}>
                {h.rating == null ? t('trainer.history.noRating') : t('trainer.history.ratingLabel', { rating: h.rating })}
              </Text>
            </View>
          </View>
        ))}
      </StateView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
    ...globals.shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginLeft: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  details: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    gap: 4,
  },
  detail: { fontSize: globals.fontSize.md, color: globals.colors.text },
  muted: { color: globals.colors.textSecondary },
});
