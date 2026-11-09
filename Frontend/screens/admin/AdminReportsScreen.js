// Admin "Revisar denuncias".
//  - Pending: each report with who made it, against whom, why, and whether the
//    reported person had reports before. The admin can ACCEPT (takes points,
//    progressive penalty), REJECT, or ESCALATE it (passed to a higher level:
//    talking to the person or deactivating the account is done outside the app).
//  - Escalated: the ones passed on; they can still be accepted or rejected.
//  - Accepted: already applied; the admin can remove one (points go back).
//  - Review requests: members saying a report against them was wrong.
//  - Suspicious behavior: too many reports received / made lately.
// Data: /admin/reports/* (Backend/src/services/report.service.js).

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import { formatDate } from '../../utils/format';
import * as adminApi from '../../apiClient/services/admin.api';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import Card from '../../components/admin/Card';
import Chips from '../../components/admin/Chips';
import SectionTitle from '../../components/admin/SectionTitle';
import StatusPill from '../../components/admin/StatusPill';
import AdminButton from '../../components/admin/AdminButton';
import StateView from '../../components/common/StateView';
import useLoad from '../../hooks/useLoad';
import useLiveLoad from '../../hooks/useLiveLoad';

const loadSuspicious = async () => (await adminApi.getSuspicious()).data ?? [];
const loadReviewRequests = async () => (await adminApi.getReviewRequests()).data ?? [];

export default function AdminReportsScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('PENDING');
  const [counts, setCounts] = useState(null);

  const options = [
    { key: 'PENDING', label: `${t('admin.reports.tabPending')}${counts ? ` (${counts.pending})` : ''}` },
    { key: 'ESCALATED', label: `${t('admin.reports.tabEscalated')}${counts ? ` (${counts.escalated})` : ''}` },
    { key: 'ACCEPTED', label: t('admin.reports.tabAccepted') },
    { key: 'REVIEWS', label: t('admin.reports.tabReviews') },
    { key: 'SUSPICIOUS', label: t('admin.reports.tabSuspicious') },
  ];

  return (
    <ScreenBody title={t('admin.reports.title')} subtitle={t('admin.reports.subtitle')}>
      <Chips options={options} value={tab} onChange={setTab} />
      {tab === 'REVIEWS' ? (
        <ReviewRequests />
      ) : tab === 'SUSPICIOUS' ? (
        <Suspicious />
      ) : (
        <ReportList key={tab} state={tab} onCounts={setCounts} />
      )}
    </ScreenBody>
  );
}

// ── Reasons ──

/** Known reason codes are translated; free text typed by a member is shown as written. */
function useReasonLabel() {
  const { t } = useTranslation();
  return (report) => {
    const codes = ['MACHINE_DAMAGE', 'MISCONDUCT', 'RULE_VIOLATION', 'FALSE_CLAIM', 'OTHER', 'TRAINER_MISCONDUCT', 'TRAINER_FALSE_HELP', 'MACHINE_BROKEN', 'MEMBER_MISCONDUCT'];
    if (codes.includes(report.reason)) return t(`admin.reports.reasons.${report.reason}`);
    if (report.source === 'AUTO_NO_HELP') return t('admin.reports.reasons.AUTO_NO_HELP');
    if (report.source === 'AUTO_MACHINE_CONFLICT') return t('admin.reports.reasons.AUTO_MACHINE_CONFLICT');
    return report.reason;
  };
}

// ── Pending / escalated / accepted ──

function ReportList({ state, onCounts }) {
  const { t } = useTranslation();
  const reasonLabel = useReasonLabel();
  const loader = useCallback(async () => (await adminApi.getReports(state)).data, [state]);
  const { data, loading, error, reload } = useLiveLoad(loader, ['reports']);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [open, setOpen] = useState({}); // report key -> showing earlier reports

  useEffect(() => {
    if (data?.counts) onCounts?.(data.counts);
  }, [data, onCounts]);

  const act = useCallback(
    async (report, action) => {
      const key = `${report.kind}:${report.id}`;
      setBusy(key);
      setMessage(null);
      try {
        const { data: result } = await action(report.kind, report.id);
        if (action === adminApi.acceptReport) {
          setMessage(
            result.penalty > 0
              ? t('admin.reports.acceptedPenalty', { points: result.penalty })
              : t('admin.reports.acceptedNoPenalty')
          );
        } else if (action === adminApi.revertReport) {
          setMessage(t('admin.reports.reverted', { points: result.refunded }));
        }
        await reload({ silent: true });
      } catch (err) {
        setMessage(err.message);
      } finally {
        setBusy(null);
      }
    },
    [reload, t]
  );

  const items = data?.items ?? [];

  return (
    <StateView
      loading={loading}
      error={error}
      onRetry={reload}
      empty={items.length === 0}
      emptyText={t(`admin.reports.empty_${state}`)}
    >
      {!!message && <Text style={styles.message}>{message}</Text>}
      {items.map((r) => {
        const key = `${r.kind}:${r.id}`;
        const disabled = busy === key;
        const prev = r.previousReports;
        const subject = r.reported?.name ?? r.machine?.name ?? '–';
        return (
          <Card key={key}>
            <View style={styles.head}>
              <Avatar name={subject} size={44} />
              <View style={styles.headTexts}>
                <Text style={styles.name} numberOfLines={1}>{subject}</Text>
                <Text style={styles.caption}>
                  {t('admin.reports.reportedBy', { name: r.reporter?.name ?? '–', date: formatDate(r.createdAt) })}
                </Text>
              </View>
              {r.machine && !r.reported && <StatusPill label={t('admin.reports.machineTag')} tone="grey" />}
            </View>

            <Text style={styles.body}>{reasonLabel(r)}</Text>
            {!!r.comment && <Text style={styles.comment}>{r.comment}</Text>}

            {prev && (
              <View style={styles.history}>
                <Text style={styles.historyTitle}>
                  {prev.total === 0
                    ? t('admin.reports.noPrevious')
                    : t('admin.reports.previous', { total: prev.total, accepted: prev.accepted, rejected: prev.rejected })}
                </Text>
                {prev.total > 0 && (
                  <TouchableOpacity onPress={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} accessibilityRole="button">
                    <Text style={styles.link}>{open[key] ? t('admin.reports.hidePrevious') : t('admin.reports.showPrevious')}</Text>
                  </TouchableOpacity>
                )}
                {open[key] &&
                  prev.recent.map((p) => (
                    <View key={`${p.kind}:${p.id}`} style={styles.prevRow}>
                      <Text style={styles.prevText} numberOfLines={1}>{formatDate(p.createdAt)} · {reasonLabel(p)}</Text>
                      <StatusPill
                        label={t(`admin.reports.state_${p.state}`)}
                        tone={p.state === 'ACCEPTED' ? 'danger' : p.state === 'REJECTED' ? 'grey' : 'teal'}
                      />
                    </View>
                  ))}
              </View>
            )}

            {(state === 'PENDING' || state === 'ESCALATED') && r.reported && (
              <Text style={styles.consequence}>
                {r.nextPenalty > 0
                  ? t('admin.reports.willTake', { points: r.nextPenalty, current: r.points ?? 0 })
                  : t('admin.reports.willTakeNothing')}
              </Text>
            )}

            {state === 'ACCEPTED' ? (
              <View style={styles.actions}>
                {r.penaltyPoints > 0 && <Text style={styles.consequence}>{t('admin.reports.tookPoints', { points: r.penaltyPoints })}</Text>}
                <AdminButton
                  label={t('admin.reports.remove')}
                  variant="danger"
                  disabled={disabled}
                  onPress={() => act(r, adminApi.revertReport)}
                  style={styles.action}
                />
              </View>
            ) : (
              <>
                <View style={styles.actions}>
                  <AdminButton label={t('admin.reports.accept')} variant="primary" disabled={disabled} onPress={() => act(r, adminApi.acceptReport)} style={styles.action} />
                  <AdminButton label={t('admin.reports.reject')} disabled={disabled} onPress={() => act(r, adminApi.rejectReport)} style={styles.action} />
                </View>
                {state === 'PENDING' && (
                  <AdminButton label={t('admin.reports.escalate')} variant="danger" disabled={disabled} onPress={() => act(r, adminApi.escalateReport)} style={styles.escalate} />
                )}
              </>
            )}
          </Card>
        );
      })}
      {state === 'ESCALATED' && items.length > 0 && <Text style={styles.sectionHint}>{t('admin.reports.escalatedHint')}</Text>}
    </StateView>
  );
}

// ── Review requests ──

function ReviewRequests() {
  const { t } = useTranslation();
  const reasonLabel = useReasonLabel();
  const { data, loading, error, reload } = useLoad(loadReviewRequests);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      await reload({ silent: true });
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(null);
    }
  };

  const items = data ?? [];
  return (
    <>
      <Text style={styles.sectionHint}>{t('admin.reports.reviewHint')}</Text>
      <StateView loading={loading} error={error} onRetry={reload} empty={items.length === 0} emptyText={t('admin.reports.emptyReviews')}>
        {!!message && <Text style={styles.message}>{message}</Text>}
        {items.map((q) => (
          <Card key={q.id}>
            <View style={styles.head}>
              <Avatar name={q.user?.name} size={44} />
              <View style={styles.headTexts}>
                <Text style={styles.name} numberOfLines={1}>{q.user?.name}</Text>
                <Text style={styles.caption}>{t('admin.reports.reviewSent', { date: formatDate(q.createdAt) })}</Text>
              </View>
            </View>
            <Text style={styles.body}>{q.message}</Text>

            <Text style={styles.historyTitle}>
              {q.acceptedReports.length === 0 ? t('admin.reports.noAcceptedReports') : t('admin.reports.theirAcceptedReports')}
            </Text>
            {q.acceptedReports.map((r) => (
              <View key={`${r.kind}:${r.id}`} style={styles.prevRow}>
                <Text style={styles.prevText} numberOfLines={2}>
                  {formatDate(r.reviewedAt ?? r.createdAt)} · {reasonLabel(r)}
                  {r.penaltyPoints > 0 ? ` · −${r.penaltyPoints}` : ''}
                </Text>
                <AdminButton
                  label={t('admin.reports.remove')}
                  variant="danger"
                  disabled={busy === `${r.kind}:${r.id}`}
                  onPress={() => run(`${r.kind}:${r.id}`, () => adminApi.revertReport(r.kind, r.id))}
                />
              </View>
            ))}

            <AdminButton
              label={t('admin.reports.markReviewed')}
              variant="primary"
              disabled={busy === q.id}
              onPress={() => run(q.id, () => adminApi.resolveReviewRequest(q.id))}
              style={styles.escalate}
            />
          </Card>
        ))}
      </StateView>
    </>
  );
}

// ── Suspicious behavior ──

function Suspicious() {
  const { t } = useTranslation();
  const reasonLabel = useReasonLabel();
  const { data, loading, error, reload } = useLoad(loadSuspicious);
  const [detail, setDetail] = useState({}); // userId -> { loading, error, data }

  const toggle = async (userId) => {
    if (detail[userId]) {
      setDetail((d) => {
        const { [userId]: _removed, ...rest } = d;
        return rest;
      });
      return;
    }
    setDetail((d) => ({ ...d, [userId]: { loading: true } }));
    try {
      const { data: reports } = await adminApi.getReportsOfUser(userId);
      setDetail((d) => ({ ...d, [userId]: { data: reports } }));
    } catch (err) {
      setDetail((d) => ({ ...d, [userId]: { error: err.message } }));
    }
  };

  const items = data ?? [];
  return (
    <>
      <Text style={styles.sectionHint}>{t('admin.reports.suspiciousHint')}</Text>
      <StateView loading={loading} error={error} onRetry={reload} empty={items.length === 0} emptyText={t('admin.reports.emptySuspicious')}>
        {items.map((s) => {
          const key = `${s.userId}:${s.kind}`;
          const d = detail[s.userId];
          return (
            <Card key={key}>
              <View style={styles.head}>
                <Avatar name={s.name} size={44} />
                <View style={styles.headTexts}>
                  <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                  <Text style={styles.caption}>
                    {t(s.kind === 'received' ? 'admin.reports.receivedMany' : 'admin.reports.madeMany', { count: s.count, days: s.days })}
                  </Text>
                </View>
                <StatusPill label={t(s.kind === 'received' ? 'admin.reports.tagReceived' : 'admin.reports.tagMade')} tone="danger" />
              </View>
              <AdminButton
                label={d ? t('admin.reports.hideDetail') : t('admin.reports.viewDetail')}
                onPress={() => toggle(s.userId)}
                style={styles.escalate}
              />
              {d?.loading && <Text style={styles.caption}>{t('common.loading')}</Text>}
              {!!d?.error && <Text style={styles.message}>{d.error}</Text>}
              {d?.data &&
                (s.kind === 'received' ? d.data.received : d.data.made).map((r) => (
                  <View key={`${r.kind}:${r.id}`} style={styles.prevRow}>
                    <Text style={styles.prevText} numberOfLines={2}>
                      {formatDate(r.createdAt)} · {reasonLabel(r)} · {s.kind === 'received' ? r.reporter?.name : r.reported?.name ?? r.machine?.name}
                    </Text>
                    <StatusPill label={t(`admin.reports.state_${r.state}`)} tone={r.state === 'ACCEPTED' ? 'danger' : 'grey'} />
                  </View>
                ))}
            </Card>
          );
        })}
      </StateView>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginHorizontal: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  body: { marginTop: globals.spacing.md, fontSize: globals.fontSize.md, color: globals.colors.text, lineHeight: 21 },
  comment: { marginTop: globals.spacing.xs, fontSize: globals.fontSize.md, color: globals.colors.textSecondary, lineHeight: 21 },
  message: { marginBottom: globals.spacing.md, color: globals.colors.primary, fontSize: globals.fontSize.md },
  history: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    gap: 6,
  },
  historyTitle: { marginTop: globals.spacing.sm, fontSize: globals.fontSize.sm + 1, fontWeight: '700', color: globals.colors.text },
  link: { fontSize: globals.fontSize.sm + 1, color: globals.colors.accent, fontWeight: '700' },
  prevRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: globals.spacing.sm, marginTop: 6 },
  prevText: { flex: 1, fontSize: globals.fontSize.sm + 1, color: globals.colors.textSecondary },
  consequence: { marginTop: globals.spacing.sm, fontSize: globals.fontSize.sm + 1, color: globals.colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: globals.spacing.sm, marginTop: globals.spacing.md },
  action: { flex: 1 },
  escalate: { marginTop: globals.spacing.sm },
  sectionHint: { marginBottom: globals.spacing.sm, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
});
