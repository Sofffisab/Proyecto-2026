// Admin "Ver gym" (dumbbell tab) — mockup "Ver gym admin": go to Members and
// go to Statistics.

import React from 'react';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import MenuCard from '../../components/trainer/MenuCard';
import { UsersIcon } from '../../components/trainer/TrainerIcons';
import { BarChartIcon } from '../../components/admin/AdminIcons';

export const ADMIN_GYM_TARGETS = {
  MEMBERS: 'members',
  STATS: 'stats',
};

export default function AdminGymScreen({ onOpen }) {
  const { t } = useTranslation();
  return (
    <ScreenBody title={t('admin.gym.title')} subtitle={t('admin.gym.subtitle')}>
      <MenuCard
        Icon={UsersIcon}
        title={t('admin.gym.membersTitle')}
        subtitle={t('admin.gym.membersSub')}
        onPress={() => onOpen?.(ADMIN_GYM_TARGETS.MEMBERS)}
      />
      <MenuCard
        Icon={BarChartIcon}
        title={t('admin.gym.statsTitle')}
        subtitle={t('admin.gym.statsSub')}
        onPress={() => onOpen?.(ADMIN_GYM_TARGETS.STATS)}
      />
    </ScreenBody>
  );
}
