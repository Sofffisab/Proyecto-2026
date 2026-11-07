// Trainer "Gestión" hub (calendar tab): the four tools from the mockup —
// routine requests, machine conflicts to verify, report, and QRs.

import React from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import MenuCard from '../../components/trainer/MenuCard';
import { ClipboardIcon, AlertIcon, FlagIcon, QrIcon } from '../../components/trainer/TrainerIcons';

export const TRAINER_HUB_TARGETS = {
  ROUTINES: 'routines',
  CONFLICTS: 'conflicts',
  REPORT: 'report',
  QR: 'qr',
};

export default function TrainerHubScreen({ onOpen }) {
  const { t } = useTranslation();
  return (
    <ScreenBody title={t('trainer.hub.title')} subtitle={t('trainer.hub.subtitle')}>
      <MenuCard
        Icon={ClipboardIcon}
        title={t('trainer.routineRequests.title')}
        subtitle={t('trainer.hub.routinesSub')}
        onPress={() => onOpen(TRAINER_HUB_TARGETS.ROUTINES)}
      />
      <MenuCard
        Icon={AlertIcon}
        title={t('trainer.machineConflicts.title')}
        subtitle={t('trainer.hub.conflictsSub')}
        onPress={() => onOpen(TRAINER_HUB_TARGETS.CONFLICTS)}
      />
      <MenuCard
        Icon={FlagIcon}
        title={t('trainer.hub.reportTitle')}
        subtitle={t('trainer.hub.reportSub')}
        onPress={() => onOpen(TRAINER_HUB_TARGETS.REPORT)}
      />
      <MenuCard
        Icon={QrIcon}
        title={t('trainer.hub.qrTitle')}
        subtitle={t('trainer.hub.qrSub')}
        onPress={() => onOpen(TRAINER_HUB_TARGETS.QR)}
      />
    </ScreenBody>
  );
}
