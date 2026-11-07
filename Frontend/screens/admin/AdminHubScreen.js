// Admin "Gestión" hub (briefcase tab) — mockup "Pantalla admin": go to Prizes,
// go to Review reports, and Generate new QR.

import React from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import MenuCard from '../../components/trainer/MenuCard';
import { FlagIcon, QrIcon } from '../../components/trainer/TrainerIcons';
import { GiftIcon } from '../../components/admin/AdminIcons';

export const ADMIN_HUB_TARGETS = {
  PRIZES: 'prizes',
  REPORTS: 'reports',
  QR: 'qr',
};

export default function AdminHubScreen({ onOpen }) {
  const { t } = useTranslation();
  return (
    <ScreenBody title={t('admin.hub.title')} subtitle={t('admin.hub.subtitle')}>
      <MenuCard
        Icon={GiftIcon}
        title={t('admin.hub.prizesTitle')}
        subtitle={t('admin.hub.prizesSub')}
        onPress={() => onOpen?.(ADMIN_HUB_TARGETS.PRIZES)}
      />
      <MenuCard
        Icon={FlagIcon}
        title={t('admin.hub.reportsTitle')}
        subtitle={t('admin.hub.reportsSub')}
        onPress={() => onOpen?.(ADMIN_HUB_TARGETS.REPORTS)}
      />
      <MenuCard
        Icon={QrIcon}
        title={t('admin.hub.qrTitle')}
        subtitle={t('admin.hub.qrSub')}
        onPress={() => onOpen?.(ADMIN_HUB_TARGETS.QR)}
      />
    </ScreenBody>
  );
}
