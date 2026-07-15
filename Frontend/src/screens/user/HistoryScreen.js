// src/screens/user/HistoryScreen.js
//
// History Screen (User) - spec section 4: "Muestra de forma detallada:
// interacciones sociales, interacciones con el entrenador, qué máquinas
// usaron y qué día, si les dieron algún logro o premio, cuándo suman
// puntos, si hicieron alguna denuncia, cuándo llegaron y cuándo se
// fueron."
//
// No single Backend endpoint returns this combined feed, so this screen
// fetches from seven different resources in parallel and renders them as
// separate sections (still "one History screen", just not one flat list):
//   - GET /gym/sessions              -> arrival/departure (gym.api.js)
//   - GET /history/machine-usage     -> machines used, by day (history.api.js)
//   - GET /history/interactions      -> trainer + social interactions (history.api.js)
//   - GET /gamification/badges       -> achievements (gamification.api.js)
//   - GET /rewards/redemptions/me    -> prizes received (reward.api.js)
//   - GET /gamification/points       -> points log (gamification.api.js)
//   - GET /complaints/me             -> reports filed (complaint.api.js)
// Promise.allSettled is used so one failing section doesn't blank the
// rest of the screen.

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import { useTranslation } from '../../i18n/I18nContext';
import * as gymApi from '../../api/services/gym.api';
import * as historyApi from '../../api/services/history.api';
import * as gamificationApi from '../../api/services/gamification.api';
import * as rewardApi from '../../api/services/reward.api';
import * as complaintApi from '../../api/services/complaint.api';

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

/**
 * A single section: title + either a loading spinner, an empty message,
 * or the list of rendered rows passed as children.
 */
function Section({ title, loading, empty, emptyLabel, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={globals.colors.primary} />
      ) : empty ? (
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      ) : (
        children
      )}
    </View>
  );
}

/**
 * @param {function} [onBack]
 */
export default function HistoryScreen({ onBack }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [machineLog, setMachineLog] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [pointsLog, setPointsLog] = useState([]);
  const [reports, setReports] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [
      sessionsResult,
      machineLogResult,
      interactionsResult,
      achievementsResult,
      rewardsResult,
      pointsResult,
      reportsResult,
    ] = await Promise.allSettled([
      gymApi.getSessionHistory(),
      historyApi.getDailyMachineUsageLog(),
      historyApi.getInteractionHistory(),
      gamificationApi.getBadges(),
      rewardApi.getMyRedemptions(),
      gamificationApi.getPoints(),
      complaintApi.getMyComplaints(),
    ]);

    let anyFailed = false;

    if (sessionsResult.status === 'fulfilled') setSessions(sessionsResult.value.data ?? []);
    else anyFailed = true;

    if (machineLogResult.status === 'fulfilled') setMachineLog(machineLogResult.value.data ?? []);
    else anyFailed = true;

    if (interactionsResult.status === 'fulfilled') setInteractions(interactionsResult.value.data ?? []);
    else anyFailed = true;

    if (achievementsResult.status === 'fulfilled') setAchievements(achievementsResult.value.data ?? []);
    else anyFailed = true;

    if (rewardsResult.status === 'fulfilled') setRewards(rewardsResult.value.data ?? []);
    else anyFailed = true;

    if (pointsResult.status === 'fulfilled') setPointsLog(pointsResult.value.data?.transactions ?? []);
    else anyFailed = true;

    if (reportsResult.status === 'fulfilled') setReports(reportsResult.value.data ?? []);
    else anyFailed = true;

    setHadError(anyFailed);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.history.title')} />

      <ScrollView style={styles.content}>
        {hadError && <Text style={styles.errorText}>{t('user.history.loadError')}</Text>}

        <Section
          title={t('user.history.sessionsTitle')}
          loading={loading}
          empty={sessions.length === 0}
          emptyLabel={t('user.history.sessionsEmpty')}
        >
          {sessions.map((session) => (
            <View key={session.id} style={styles.row}>
              <Text style={styles.rowPrimary}>
                {t('user.history.arrivedAt')}: {formatDateTime(session.checkInAt)}
              </Text>
              <Text style={styles.rowSecondary}>
                {session.checkOutAt
                  ? `${t('user.history.leftAt')}: ${formatDateTime(session.checkOutAt)}${
                      session.autoClosed ? ` ${t('user.history.autoClosed')}` : ''
                    }`
                  : t('user.history.stillCheckedIn')}
              </Text>
            </View>
          ))}
        </Section>

        <Section
          title={t('user.history.machineUsageTitle')}
          loading={loading}
          empty={machineLog.length === 0}
          emptyLabel={t('user.history.machineUsageEmpty')}
        >
          {machineLog.map((day) => (
            <View key={day.date} style={styles.row}>
              <Text style={styles.rowPrimary}>{day.date}</Text>
              <Text style={styles.rowSecondary}>
                {t('user.history.machinesUsedCount', {
                  count: day.machinesUsed,
                  minutes: day.totalDurationMinutes,
                })}
              </Text>
              {day.machines.map((m, idx) => (
                <Text key={`${day.date}-${idx}`} style={styles.rowDetail}>
                  • {m.machineName} — {formatDateTime(m.startedAt)}
                  {m.endedAt ? ` → ${formatDateTime(m.endedAt)}` : ''}
                </Text>
              ))}
            </View>
          ))}
        </Section>

        <Section
          title={t('user.history.interactionsTitle')}
          loading={loading}
          empty={interactions.length === 0}
          emptyLabel={t('user.history.interactionsEmpty')}
        >
          {interactions.map((interaction, idx) => (
            <View key={idx} style={styles.row}>
              <Text style={styles.rowPrimary}>
                {interaction.type === 'TRAINER_ASSISTANCE'
                  ? t('user.history.trainerInteraction', { name: interaction.partnerName })
                  : t('user.history.socialInteraction', { name: interaction.partnerName })}
              </Text>
              <Text style={styles.rowSecondary}>{formatDateTime(interaction.date)}</Text>
            </View>
          ))}
        </Section>

        <Section
          title={t('user.history.achievementsTitle')}
          loading={loading}
          empty={achievements.length === 0}
          emptyLabel={t('user.history.achievementsEmpty')}
        >
          {achievements.map((entry) => (
            <View key={entry.id} style={styles.row}>
              <Text style={styles.rowPrimary}>{entry.achievement?.name}</Text>
              <Text style={styles.rowSecondary}>{formatDateTime(entry.unlockedAt)}</Text>
            </View>
          ))}
        </Section>

        <Section
          title={t('user.history.rewardsTitle')}
          loading={loading}
          empty={rewards.length === 0}
          emptyLabel={t('user.history.rewardsEmpty')}
        >
          {rewards.map((redemption) => (
            <View key={redemption.id} style={styles.row}>
              <Text style={styles.rowPrimary}>{redemption.reward?.name}</Text>
              <Text style={styles.rowSecondary}>
                {redemption.status} — {formatDateTime(redemption.createdAt)}
              </Text>
            </View>
          ))}
        </Section>

        <Section
          title={t('user.history.pointsTitle')}
          loading={loading}
          empty={pointsLog.length === 0}
          emptyLabel={t('user.history.pointsEmpty')}
        >
          {pointsLog.map((tx) => (
            <View key={tx.id} style={styles.row}>
              <Text style={styles.rowPrimary}>
                {tx.points > 0 ? '+' : ''}
                {tx.points} — {tx.reason}
              </Text>
              <Text style={styles.rowSecondary}>{formatDateTime(tx.createdAt)}</Text>
            </View>
          ))}
        </Section>

        <Section
          title={t('user.history.reportsTitle')}
          loading={loading}
          empty={reports.length === 0}
          emptyLabel={t('user.history.reportsEmpty')}
        >
          {reports.map((report) => (
            <View key={report.id} style={styles.row}>
              <Text style={styles.rowPrimary}>{report.reason}</Text>
              <Text style={styles.rowSecondary}>
                {report.status} — {formatDateTime(report.createdAt)}
              </Text>
            </View>
          ))}
        </Section>

        <Text style={styles.backLink} onPress={onBack}>{t('common.back')}</Text>
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
  section: {
    marginBottom: globals.spacing.lg,
  },
  sectionTitle: {
    fontSize: globals.fontSize.md,
    fontWeight: '600',
    color: globals.colors.text,
    marginBottom: globals.spacing.sm,
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
