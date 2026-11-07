// Trainer "Pantalla principal" (house tab): everyone currently in the gym.
// Tapping a row opens the "Ayudar" screen with that person's data; the
// checkbox is a visual "ya ayudado" mark. A help alert banner sits on top
// for members who pressed "Pedir Ayuda". Static data (see mockData.js).

import React, { useState } from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import PersonRow from '../../components/trainer/PersonRow';
import HelpAlertBanner from '../../components/trainer/HelpAlertBanner';
import { PEOPLE_IN_GYM } from './mockData';

export default function TrainerHomeScreen({ onOpenHelp }) {
  const { t } = useTranslation();
  const [helped, setHelped] = useState({});
  const [alertOpen, setAlertOpen] = useState(true);

  const asking = PEOPLE_IN_GYM.find((p) => p.needsHelp);

  return (
    <ScreenBody title={t('trainer.help.title')} subtitle={t('trainer.home.listHint')}>
      {asking && alertOpen && (
        <HelpAlertBanner
          name={asking.name}
          onGoHelp={() => onOpenHelp(asking)}
          onDismiss={() => setAlertOpen(false)}
        />
      )}

      {PEOPLE_IN_GYM.map((p) => (
        <PersonRow
          key={p.id}
          name={p.name}
          needsHelp={p.needsHelp}
          onPress={() => onOpenHelp(p)}
          checked={!!helped[p.id]}
          onToggle={() => setHelped((h) => ({ ...h, [p.id]: !h[p.id] }))}
          checkLabel={t('trainer.help.markHelped')}
        />
      ))}
    </ScreenBody>
  );
}
