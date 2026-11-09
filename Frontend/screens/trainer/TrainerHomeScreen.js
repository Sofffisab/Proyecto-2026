// Trainer "Pantalla principal" (house tab): everyone currently in the gym.
// Tapping a row opens the "Ayudar" screen with that person's data; the
// checkbox marks "ya ayudado" (starts and completes a help for that person).
// A help alert banner sits on top for the member who has been waiting longest
// after pressing "Pedir Ayuda". The list updates live through Ably (the server
// signals the change; there is no constant polling).
// Data: GET /gym/people.

import React, { useCallback, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import useLiveLoad from '../../hooks/useLiveLoad';
import * as trainerApi from '../../apiClient/services/trainer.api';
import ScreenBody from '../../components/trainer/ScreenBody';
import PersonRow from '../../components/trainer/PersonRow';
import HelpAlertBanner from '../../components/trainer/HelpAlertBanner';
import StateView from '../../components/common/StateView';

const loadPeople = async () => (await trainerApi.getPeopleInGym()).data ?? [];

export default function TrainerHomeScreen({ onOpenHelp }) {
  const { t } = useTranslation();
  const { data: people, loading, error, reload } = useLiveLoad(loadPeople, ['help', 'people']);
  // A dismissed banner stays dismissed for that request only: a new one shows again.
  const [dismissed, setDismissed] = useState({});
  const [actionError, setActionError] = useState(null);

  const asking = (people ?? []).find((p) => p.needsHelp && !dismissed[p.pendingAssistanceId]);

  const markHelped = useCallback(
    async (person) => {
      if (person.helpedByMe) return;
      setActionError(null);
      try {
        const { data: help } = await trainerApi.startHelp(person.id);
        await trainerApi.completeHelp(help.id);
        await reload({ silent: true });
      } catch (err) {
        setActionError(err.message);
      }
    },
    [reload]
  );

  return (
    <ScreenBody title={t('trainer.help.title')} subtitle={t('trainer.home.listHint')}>
      <StateView
        loading={loading}
        error={error}
        onRetry={reload}
        empty={(people ?? []).length === 0}
        emptyText={t('trainer.help.empty')}
      >
        {asking && (
          <HelpAlertBanner
            name={asking.name}
            onGoHelp={() => onOpenHelp(asking)}
            onDismiss={() => setDismissed((d) => ({ ...d, [asking.pendingAssistanceId]: true }))}
          />
        )}
        {!!actionError && <Text style={styles.error}>{actionError}</Text>}

        {(people ?? []).map((p) => (
          <PersonRow
            key={p.id}
            name={p.name}
            needsHelp={p.needsHelp}
            onPress={() => onOpenHelp(p)}
            checked={p.helpedByMe}
            onToggle={() => markHelped(p)}
            checkLabel={t('trainer.help.markHelped')}
          />
        ))}
      </StateView>
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  error: { color: globals.colors.danger, marginBottom: globals.spacing.md },
});
