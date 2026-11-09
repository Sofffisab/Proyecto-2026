// "Solicitudes de armado de rutina": members asking a trainer to build them a
// routine.
//   1. A request shows what the member filled in when they signed up (goal,
//      level, days per week, medical topics) — the routine is built from that.
//   2. "Accept" makes the request the trainer's. "Reject" turns it down.
//   3. "Build routine" opens the builder: pick exercises from the catalog, set
//      sets and reps, and send. The member then gets "esta es la rutina que te
//      prepararon, ¿la aceptás?" and, if they accept, it is saved in their
//      routines and added to their routine of that day.
// Data: GET /routines/requests/all and the PATCH endpoints in trainer.api.js.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import useLoad from '../../hooks/useLoad';
import useLiveLoad from '../../hooks/useLiveLoad';
import { formatDate } from '../../utils/format';
import * as trainerApi from '../../apiClient/services/trainer.api';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import FormField from '../../components/admin/FormField';
import StateView from '../../components/common/StateView';

const loadRequests = async () => (await trainerApi.getRoutineRequests()).data ?? [];

function RequestCard({ request, busy, onAccept, onReject, onBuild }) {
  const { t } = useTranslation();
  const m = request.member;
  const goals = (m.objectives ?? []).map((g) => t(`user.onboarding.goals.${g}`)).join(', ');
  const statusKey = { PENDING: 'statusPending', ACCEPTED: 'statusAccepted', PROPOSED: 'statusProposed' }[request.status];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Avatar name={m.name} size={44} />
        <View style={styles.headTexts}>
          <Text style={styles.name} numberOfLines={1}>{m.name}</Text>
          <Text style={styles.caption}>{t('trainer.routineRequests.requestedOn', { date: formatDate(request.createdAt) })}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>{t(`trainer.routineRequests.${statusKey}`)}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detail}>{t('trainer.routineRequests.goalLabel', { goal: goals || t('trainer.routineRequests.notProvided') })}</Text>
        <Text style={styles.detail}>
          {t('trainer.routineRequests.levelLabel', { level: m.level ? t(`user.onboarding.levels.${m.level}`) : t('trainer.routineRequests.notProvided') })}
        </Text>
        <Text style={styles.detail}>
          {t('trainer.routineRequests.daysLabel', { days: m.weeklyTrainingDays ? t(`user.onboarding.days.${m.weeklyTrainingDays}`) : t('trainer.routineRequests.notProvided') })}
        </Text>
        {m.medicalConditions.length > 0 && (
          <Text style={styles.detail}>{t('trainer.routineRequests.medicalLabel', { items: m.medicalConditions.join(', ') })}</Text>
        )}
      </View>

      {request.status === 'PENDING' && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnOutline, busy && styles.disabled]} onPress={onReject} disabled={busy} activeOpacity={0.8} accessibilityRole="button">
            <Text style={styles.btnOutlineLabel}>{t('trainer.routineRequests.reject')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, busy && styles.disabled]} onPress={onAccept} disabled={busy} activeOpacity={0.8} accessibilityRole="button">
            <Text style={styles.btnPrimaryLabel}>{t('trainer.routineRequests.accept')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {request.status === 'ACCEPTED' && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onBuild} activeOpacity={0.8} accessibilityRole="button">
            <Text style={styles.btnPrimaryLabel}>{t('trainer.routineRequests.build')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {request.status === 'PROPOSED' && <Text style={styles.waiting}>{t('trainer.routineRequests.waitingAnswer', { name: request.proposedName ?? '' })}</Text>}
    </View>
  );
}

// ── Builder ──

function RoutineBuilder({ request, onDone, onCancel }) {
  const { t } = useTranslation();
  const loader = useCallback(async () => (await trainerApi.getExercises()).data, []);
  const { data, loading, error, reload } = useLoad(loader);
  const firstName = (request.member.name ?? '').split(' ')[0];
  const [name, setName] = useState(t('trainer.routineRequests.defaultName', { name: firstName }));
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState([]); // [{ exerciseId, sets: '3', reps: '10-12' }]
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState(null);

  // Only the gym's own catalog: a trainer's private exercises would not exist for the member.
  const catalog = useMemo(() => (data?.exercises ?? []).filter((e) => !e.isCustom), [data]);
  const byId = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((e) => !picked.some((p) => p.exerciseId === e.id) && (!q || e.name.toLowerCase().includes(q))).slice(0, 12);
  }, [catalog, search, picked]);

  const add = (e) => setPicked((p) => [...p, { exerciseId: e.id, sets: String(e.sets ?? 3), reps: String(e.reps ?? '10') }]);
  const remove = (id) => setPicked((p) => p.filter((x) => x.exerciseId !== id));
  const edit = (id, patch) => setPicked((p) => p.map((x) => (x.exerciseId === id ? { ...x, ...patch } : x)));

  const send = async () => {
    setFormError(null);
    if (!name.trim()) return setFormError(t('trainer.routineRequests.nameRequired'));
    if (picked.length === 0) return setFormError(t('trainer.routineRequests.pickOne'));
    const exercises = [];
    for (const p of picked) {
      const sets = parseInt(p.sets, 10);
      if (!(sets >= 1 && sets <= 20) || !p.reps.trim()) return setFormError(t('trainer.routineRequests.invalidSetsReps'));
      exercises.push({ exerciseId: p.exerciseId, sets, reps: p.reps.trim() });
    }
    setSending(true);
    try {
      await trainerApi.proposeRoutine(request.id, { name: name.trim(), exercises });
      onDone();
    } catch (err) {
      setFormError(err.message);
      setSending(false);
    }
  };

  return (
    <ScreenBody title={t('trainer.routineRequests.builderTitle', { name: request.member.name })} subtitle={t('trainer.routineRequests.builderSubtitle')}>
      <StateView loading={loading} error={error} onRetry={reload}>
        <FormField label={t('trainer.routineRequests.routineName')} value={name} onChangeText={setName} autoCapitalize="sentences" />

        <Text style={styles.label}>{t('trainer.routineRequests.chosen', { count: picked.length })}</Text>
        {picked.length === 0 && <Text style={styles.muted}>{t('trainer.routineRequests.nothingChosen')}</Text>}
        {picked.map((p) => (
          <View key={p.exerciseId} style={styles.pickedRow}>
            <View style={styles.pickedHead}>
              <Text style={styles.pickedName} numberOfLines={1}>{byId.get(p.exerciseId)?.name}</Text>
              <TouchableOpacity onPress={() => remove(p.exerciseId)} hitSlop={8} accessibilityRole="button">
                <Text style={styles.removeLabel}>{t('trainer.routineRequests.remove')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickedFields}>
              <View style={styles.small}>
                <FormField label={t('trainer.routineRequests.sets')} value={p.sets} onChangeText={(v) => edit(p.exerciseId, { sets: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
              </View>
              <View style={styles.small}>
                <FormField label={t('trainer.routineRequests.reps')} value={p.reps} onChangeText={(v) => edit(p.exerciseId, { reps: v })} />
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.label}>{t('trainer.routineRequests.addExercise')}</Text>
        <FormField value={search} onChangeText={setSearch} placeholder={t('trainer.routineRequests.searchPlaceholder')} />
        {results.map((e) => (
          <TouchableOpacity key={e.id} style={styles.resultRow} onPress={() => add(e)} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.resultName} numberOfLines={1}>{e.name}</Text>
            <Text style={styles.addLabel}>+ {t('trainer.routineRequests.add')}</Text>
          </TouchableOpacity>
        ))}
        {results.length === 0 && catalog.length > 0 && <Text style={styles.muted}>{t('trainer.routineRequests.noResults')}</Text>}

        {!!formError && <Text style={styles.error}>{formError}</Text>}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={onCancel} disabled={sending} accessibilityRole="button">
            <Text style={styles.btnOutlineLabel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, sending && styles.disabled]} onPress={send} disabled={sending} accessibilityRole="button">
            <Text style={styles.btnPrimaryLabel}>{sending ? t('trainer.routineRequests.sending') : t('trainer.routineRequests.send')}</Text>
          </TouchableOpacity>
        </View>
      </StateView>
    </ScreenBody>
  );
}

export default function TrainerRoutineRequestsScreen() {
  const { t } = useTranslation();
  const { data, loading, error, reload } = useLiveLoad(loadRequests, ['routines']);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null); // { type, text }
  const [building, setBuilding] = useState(null);

  const act = useCallback(
    async (id, fn, okText) => {
      setBusyId(id);
      setMessage(null);
      try {
        await fn(id);
        if (okText) setMessage({ type: 'ok', text: okText });
        await reload({ silent: true });
      } catch (err) {
        setMessage({ type: 'error', text: err.message || t('trainer.routineRequests.actionError') });
      } finally {
        setBusyId(null);
      }
    },
    [reload, t]
  );

  if (building) {
    return (
      <RoutineBuilder
        request={building}
        onCancel={() => setBuilding(null)}
        onDone={() => {
          setBuilding(null);
          setMessage({ type: 'ok', text: t('trainer.routineRequests.sentToMember') });
          reload({ silent: true });
        }}
      />
    );
  }

  const requests = data ?? [];
  return (
    <ScreenBody title={t('trainer.routineRequests.title')} subtitle={t('trainer.routineRequests.subtitle')}>
      {!!message && <Text style={[styles.message, message.type === 'error' && styles.error]}>{message.text}</Text>}
      <StateView loading={loading} error={error} onRetry={reload} empty={requests.length === 0} emptyText={t('trainer.routineRequests.empty')}>
        {requests.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            busy={busyId === r.id}
            onAccept={() => act(r.id, trainerApi.acceptRoutineRequest)}
            onReject={() => act(r.id, trainerApi.rejectRoutineRequest)}
            onBuild={() => setBuilding(r)}
          />
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
  headTexts: { flex: 1, marginHorizontal: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  chip: {
    backgroundColor: globals.colors.tealSoft,
    borderRadius: globals.radius.full,
    paddingVertical: 4,
    paddingHorizontal: globals.spacing.sm + 2,
  },
  chipLabel: { fontSize: globals.fontSize.sm, fontWeight: '600', color: globals.colors.primary },
  details: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    gap: 4,
  },
  detail: { fontSize: globals.fontSize.md, color: globals.colors.text },
  waiting: { marginTop: globals.spacing.md, fontSize: globals.fontSize.sm + 1, color: globals.colors.textSecondary },
  actions: { flexDirection: 'row', gap: globals.spacing.sm, marginTop: globals.spacing.md },
  btn: { flex: 1, alignItems: 'center', borderRadius: globals.radius.full, paddingVertical: 12 },
  btnPrimary: { backgroundColor: globals.colors.primary },
  btnPrimaryLabel: { color: '#fff', fontWeight: '700', fontSize: globals.fontSize.md },
  btnOutline: { borderWidth: 1.5, borderColor: globals.colors.primary, backgroundColor: globals.colors.surface },
  btnOutlineLabel: { color: globals.colors.primary, fontWeight: '700', fontSize: globals.fontSize.md },
  disabled: { opacity: 0.5 },
  message: { marginBottom: globals.spacing.md, color: globals.colors.primary, fontSize: globals.fontSize.md },
  error: { color: globals.colors.danger, marginTop: globals.spacing.sm },
  label: {
    fontSize: globals.fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: globals.colors.accent,
    marginTop: globals.spacing.sm,
    marginBottom: globals.spacing.sm,
  },
  muted: { color: globals.colors.textSecondary, marginBottom: globals.spacing.md },
  pickedRow: {
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    borderRadius: globals.radius.lg,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.sm,
    backgroundColor: globals.colors.surface,
  },
  pickedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: globals.spacing.sm },
  pickedName: { flex: 1, fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  removeLabel: { color: globals.colors.danger, fontWeight: '700' },
  pickedFields: { flexDirection: 'row', gap: globals.spacing.sm },
  small: { flex: 1 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: globals.colors.surfaceBorder,
  },
  resultName: { flex: 1, fontSize: globals.fontSize.md, color: globals.colors.text },
  addLabel: { color: globals.colors.primary, fontWeight: '700' },
});
