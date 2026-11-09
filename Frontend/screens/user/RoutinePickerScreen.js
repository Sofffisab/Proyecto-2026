// src/screens/user/RoutinePickerScreen.js
//
// "Elegí tu rutina" — which kind of routine to follow today. It replaces the
// three checkbox rows of the old Routines screen and keeps what each did:
//   - Pre hecha (por la app)      -> follow the general routines, then pick one
//   - Mi rutina personalizada     -> follow "mis rutinas", opens the weekly schedule
//   - Personalizada por IA        -> AiRoutineScreen (preview + save)
//   - No seguir rutina (libre)    -> free training (camera only)

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from '../../i18n/I18nContext';
import { useRoutines } from '../../context/RoutinesContext';
import { ROUTINE_OPTIONS } from '../../constants/generalRoutines';
import {
  BackHeader,
  ChoiceCard,
  Footer,
  PersonIcon,
  BrainIcon,
  SparklesIcon,
  DumbbellIcon,
  routineKitStyles,
} from '../../components/common/RoutineKit';
import { PrimaryButton, OutlineButton } from '../../components/common/PopupKit';
import * as routineApi from '../../features/api/services/routine.api';

const PICK = { PREMADE: 'premade', MINE: 'mine', AI: 'ai', FREE: 'free' };

/**
 * @param {function} [onBack]
 * @param {function} [onDone] - nothing else to configure (free training)
 * @param {function} [onGoToGeneralRoutines] - list of default routines
 * @param {function} [onGoToSchedule] - weekly schedule ("mis rutinas")
 * @param {function} [onGoToAiRoutine] - AI routine screen
 */
export default function RoutinePickerScreen({ onBack, onDone, onGoToGeneralRoutines, onGoToSchedule, onGoToAiRoutine }) {
  const { t } = useTranslation();
  const { routineOption, setRoutineOption } = useRoutines();

  const initial =
    routineOption === ROUTINE_OPTIONS.GENERAL_ROUTINES
      ? PICK.PREMADE
      : routineOption === ROUTINE_OPTIONS.NO_ROUTINE
        ? PICK.FREE
        : PICK.MINE;
  const [pick, setPick] = useState(initial);

  // "Pedir rutina a un entrenador": one open request at a time.
  const [openRequest, setOpenRequest] = useState(null); // PENDING | ACCEPTED | PROPOSED | null
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState(null); // { type, text }

  useEffect(() => {
    let alive = true;
    routineApi
      .getMyRoutineRequests()
      .then(({ data }) => {
        const open = (data ?? []).find((r) => ['PENDING', 'ACCEPTED', 'PROPOSED'].includes(r.status));
        if (alive) setOpenRequest(open?.status ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const requestFromTrainer = async () => {
    setRequesting(true);
    setRequestMessage(null);
    try {
      await routineApi.requestRoutine();
      setOpenRequest('PENDING');
      setRequestMessage({ type: 'ok', text: t('user.routines.requestSent') });
    } catch (err) {
      setRequestMessage({ type: 'error', text: err.message || t('user.routines.requestError') });
    } finally {
      setRequesting(false);
    }
  };

  const handleNext = () => {
    if (pick === PICK.PREMADE) {
      setRoutineOption(ROUTINE_OPTIONS.GENERAL_ROUTINES);
      onGoToGeneralRoutines && onGoToGeneralRoutines();
    } else if (pick === PICK.MINE) {
      setRoutineOption(ROUTINE_OPTIONS.MY_ROUTINES);
      onGoToSchedule && onGoToSchedule();
    } else if (pick === PICK.AI) {
      onGoToAiRoutine && onGoToAiRoutine();
    } else {
      setRoutineOption(ROUTINE_OPTIONS.NO_ROUTINE);
      onDone && onDone();
    }
  };

  const options = [
    { key: PICK.PREMADE, icon: <PersonIcon />, title: t('user.routines.pickPremade'), desc: t('user.routines.pickPremadeDesc') },
    { key: PICK.MINE, icon: <BrainIcon />, title: t('user.routines.pickMine'), desc: t('user.routines.pickMineDesc') },
    { key: PICK.AI, icon: <SparklesIcon />, title: t('user.routines.pickAi'), desc: t('user.routines.pickAiDesc') },
    { key: PICK.FREE, icon: <DumbbellIcon />, title: t('user.routines.pickFree'), desc: t('user.routines.pickFreeDesc') },
  ];

  return (
    <View style={routineKitStyles.screen}>
      <BackHeader
        title={t('user.routines.pickerTitle')}
        subtitle={t('user.routines.pickerSubtitle')}
        onBack={onBack}
        backLabel={t('user.routines.back')}
      />
      <ScrollView style={routineKitStyles.body} showsVerticalScrollIndicator={false}>
        {options.map((opt) => (
          <ChoiceCard
            key={opt.key}
            compact
            icon={opt.icon}
            title={opt.title}
            description={opt.desc}
            selected={pick === opt.key}
            onPress={() => setPick(opt.key)}
          />
        ))}

        <OutlineButton
          label={t('user.routines.requestFromTrainer')}
          onPress={requestFromTrainer}
          disabled={requesting || !!openRequest}
          style={{ marginTop: 8 }}
        />
        {!!openRequest && (
          <Text style={{ marginTop: 8, textAlign: 'center' }}>{t(`user.routines.requestStatus_${openRequest}`)}</Text>
        )}
        {!!requestMessage && <Text style={{ marginTop: 8, textAlign: 'center' }}>{requestMessage.text}</Text>}
      </ScrollView>
      <Footer>
        <PrimaryButton label={t('user.routines.next')} onPress={handleNext} />
      </Footer>
    </View>
  );
}
