// "Esta es la rutina que te prepararon, ¿la aceptás?"
//
// Shown to a member when a trainer finished the routine they asked for. They
// can preview every exercise and then accept or decline it:
//   - accept  -> it is saved in their routines (the default routines of their
//                account) and added to today's routine.
//   - decline -> nothing is kept; the trainer is told.
// Data: GET /routines/proposals, POST /routines/requests/:id/respond.

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as routineApi from '../../features/api/services/routine.api';
import { PopupModal, Title, Subtitle, PrimaryButton, OutlineButton, SoftCard } from '../common/PopupKit';

/**
 * @param {object}   proposal  - one item of GET /routines/proposals
 * @param {function} onAnswered - (accepted: boolean) => void, after the answer was saved
 * @param {function} [onLater]  - closes the pop-up without answering (it shows again next time)
 */
export default function RoutineProposalPopup({ proposal, onAnswered, onLater }) {
  const { t, language } = useTranslation();
  const [busy, setBusy] = useState(null); // 'accept' | 'decline'
  const [error, setError] = useState(null);

  const answer = async (accept) => {
    setBusy(accept ? 'accept' : 'decline');
    setError(null);
    try {
      await routineApi.respondToRoutineProposal(proposal.id, accept, routineApi.toLocalDateKey());
      onAnswered?.(accept);
    } catch (err) {
      setError(err.message || t('user.routines.proposal.error'));
      setBusy(null);
    }
  };

  const exerciseName = (ex) => (language === 'en' && ex.exercise?.nameEn ? ex.exercise.nameEn : ex.exercise?.name);

  return (
    <PopupModal onClose={busy ? undefined : onLater} closeLabel={t('common.close')}>
      <Title>{t('user.routines.proposal.title')}</Title>
      <Subtitle>
        {proposal.trainer?.name
          ? t('user.routines.proposal.subtitleFrom', { name: proposal.trainer.name })
          : t('user.routines.proposal.subtitle')}
      </Subtitle>

      <SoftCard style={styles.card}>
        <Text style={styles.routineName}>{proposal.name}</Text>
        <Text style={styles.meta}>
          {t('user.routines.proposal.summary', { count: proposal.exercises.length, minutes: proposal.estimatedMinutes })}
        </Text>
        {proposal.exercises.map((ex) => (
          <View key={ex.exerciseId} style={styles.row}>
            <Text style={styles.exName} numberOfLines={2}>{exerciseName(ex)}</Text>
            <Text style={styles.exSets}>{ex.sets} × {ex.reps}</Text>
          </View>
        ))}
      </SoftCard>

      <Text style={styles.note}>{t('user.routines.proposal.note')}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton
        label={t('user.routines.proposal.accept')}
        onPress={() => answer(true)}
        loading={busy === 'accept'}
        disabled={!!busy}
      />
      <OutlineButton
        label={t('user.routines.proposal.decline')}
        onPress={() => answer(false)}
        disabled={!!busy}
        style={styles.decline}
      />
    </PopupModal>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, alignSelf: 'stretch' },
  routineName: { fontSize: globals.fontSize.lg, fontWeight: '700', color: globals.colors.text },
  meta: { marginTop: 2, marginBottom: 8, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
  },
  exName: { flex: 1, fontSize: globals.fontSize.md, color: globals.colors.text },
  exSets: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.primary },
  note: { marginVertical: 12, textAlign: 'center', fontSize: globals.fontSize.sm, color: globals.colors.captionGrey, lineHeight: 17 },
  error: { marginBottom: 8, textAlign: 'center', color: globals.colors.danger },
  decline: { marginTop: 8 },
});
