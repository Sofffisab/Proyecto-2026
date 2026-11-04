// src/screens/user/RoutineModeScreen.js
//
// "¿Cómo querés entrenar?" — shown after "Ver ejercicios" on the Routines
// screen. Picks HOW to follow today's routine and then opens the same two
// screens as before:
//   - "Guía paso a paso"   -> StepByStepScreen (hints + rest time)
//   - "Leer por su cuenta" -> FreeRoutineScreen (read-only info, no guide)

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';
import { BackHeader, ChoiceCard, Footer, GuideIcon, BookIcon, routineKitStyles } from '../../components/common/RoutineKit';
import { PrimaryButton } from '../../components/common/PopupKit';

export const START_MODES = { STEP_BY_STEP: 'stepByStep', FREE: 'free' };

/**
 * @param {string} source - ROUTINE_SOURCES value of the routine being opened.
 * @param {string} dateKey
 * @param {string} [generalRoutineId]
 * @param {function} [onBack]
 * @param {function} [onStart] - (mode, { source, dateKey, generalRoutineId }) => void
 */
export default function RoutineModeScreen({ source, dateKey, generalRoutineId, onBack, onStart }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(START_MODES.STEP_BY_STEP);

  return (
    <View style={routineKitStyles.screen}>
      <BackHeader
        title={t('user.routines.modeTitle')}
        subtitle={t('user.routines.modeSubtitle')}
        onBack={onBack}
        backLabel={t('user.routines.back')}
      />
      <View style={[routineKitStyles.body, { paddingTop: 24 }]}>
        <ChoiceCard
          icon={<GuideIcon />}
          title={t('user.routines.modeGuided')}
          description={t('user.routines.modeGuidedDesc')}
          selected={mode === START_MODES.STEP_BY_STEP}
          onPress={() => setMode(START_MODES.STEP_BY_STEP)}
        />
        <ChoiceCard
          icon={<BookIcon />}
          title={t('user.routines.modeSelf')}
          description={t('user.routines.modeSelfDesc')}
          selected={mode === START_MODES.FREE}
          onPress={() => setMode(START_MODES.FREE)}
        />
      </View>
      <Footer>
        <PrimaryButton
          label={t('user.routines.next')}
          onPress={() => onStart && onStart(mode, { source, dateKey, generalRoutineId })}
        />
      </Footer>
    </View>
  );
}
