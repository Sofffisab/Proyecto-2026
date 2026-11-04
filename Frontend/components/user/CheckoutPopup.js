// Exit pop-up: shown right after the exit QR scan (CHECK_OUT).
//
//   MAIN        rate the day (1-5 stars), rate each trainer who helped, and a
//               "Denuncias" button. [Enviar] sends everything in one request.
//   DENUNCIAS   three categories, each limited to what was really in the gym
//               during the visit (GET /gym/sessions/:id/checkout-context):
//                 - Entrenador: "mal comportamiento" / "mintió sobre ayudar"
//                 - Máquina: rota o no funciona
//                 - Compañero: mal comportamiento
//
// Same look as SocialInteractionPopup (white card, teal ✕, soft inner cards;
// shared pieces in components/common/PopupKit.js).
// Denuncias end up in the `denuncias` table (Backend/src/services/denuncia.service.js).

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as gymApi from '../../features/api/services/gym.api';
import {
  HERO,
  PopupModal,
  Hero,
  Title,
  Subtitle,
  PrimaryButton,
  SoftCard,
  Avatar,
  Stars,
  CheckRow,
  FlagIcon,
  ChevronRightIcon,
  CheckIcon,
  popupStyles,
} from '../common/PopupKit';

const VIEW = { MAIN: 'MAIN', DENUNCIAS: 'DENUNCIAS', CATEGORY: 'CATEGORY' };
const CATEGORY = { TRAINER: 'TRAINER', MACHINE: 'MACHINE', MEMBER: 'MEMBER' };

const denunciaKey = (type, id) => `${type}:${id}`;

/**
 * @param {string} sessionId  the gym session that just ended
 * @param {function} onClose  called when the pop-up is dismissed or sent
 */
export default function CheckoutPopup({ sessionId, onClose }) {
  const { t } = useTranslation();
  const k = (name, params) => t(`user.popups.checkout.${name}`, params);

  const [ctx, setCtx] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [view, setView] = useState(VIEW.MAIN);
  const [category, setCategory] = useState(null);

  const [dayRating, setDayRating] = useState(0);
  const [trainerRatings, setTrainerRatings] = useState({}); // trainerId -> 1..5
  const [selected, setSelected] = useState({}); // denunciaKey -> { type, reportedUserId | machineId }

  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!sessionId) {
      setLoadFailed(true);
      return undefined;
    }
    gymApi
      .getCheckoutContext(sessionId)
      .then((res) => !cancelled && setCtx(res.data))
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const toggleDenuncia = (type, field, id) =>
    setSelected((prev) => {
      const key = denunciaKey(type, id);
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = { type, [field]: id };
      return next;
    });

  const denunciaCount = Object.keys(selected).length;
  const toRate = (ctx?.trainersHelped ?? []).filter((tr) => !tr.rated);

  const send = async () => {
    const ratings = Object.entries(trainerRatings).map(([trainerId, rating]) => ({ trainerId, rating }));
    const body = {
      ...(dayRating > 0 ? { dayRating } : {}),
      ...(ratings.length ? { trainerRatings: ratings } : {}),
      ...(denunciaCount ? { denuncias: Object.values(selected) } : {}),
    };
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setSending(true);
    setError(null);
    try {
      await gymApi.submitCheckoutFeedback(sessionId, body);
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.message || k('error'));
    } finally {
      setSending(false);
    }
  };

  const goBack = () => {
    if (view === VIEW.CATEGORY) setView(VIEW.DENUNCIAS);
    else setView(VIEW.MAIN);
    setCategory(null);
  };

  const titles = {
    [VIEW.MAIN]: k('title'),
    [VIEW.DENUNCIAS]: k('denunciasTitle'),
    [VIEW.CATEGORY]: category ? k(`category.${category}`) : '',
  };
  const subtitles = {
    [VIEW.MAIN]: k('subtitle'),
    [VIEW.DENUNCIAS]: k('denunciasHint'),
    [VIEW.CATEGORY]: null,
  };

  let body;
  if (sent) {
    body = (
      <View style={popupStyles.center}>
        <Hero source={HERO.found} width={84} height={46} />
        <Title>{k('thanks')}</Title>
      </View>
    );
  } else if (!ctx && !loadFailed) {
    body = <ActivityIndicator color={globals.colors.primary} style={styles.loader} />;
  } else if (view === VIEW.MAIN) {
    body = (
      <>
        <SoftCard style={[styles.rateCard, popupStyles.gapMd]}>
          <Text style={styles.label}>{k('rateDay')}</Text>
          <Stars value={dayRating} onChange={setDayRating} size={30} />
          <Text style={[popupStyles.muted, { marginTop: 4 }]}>{k('optional')}</Text>
        </SoftCard>

        {toRate.map((tr) => (
          <SoftCard key={tr.id} style={[styles.rateCard, popupStyles.gapSm]}>
            <View style={popupStyles.row}>
              <Avatar size={30} />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.name}>{tr.name}</Text>
                <Text style={popupStyles.muted}>{k('rateTrainer')}</Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <Stars
                value={trainerRatings[tr.id] ?? 0}
                onChange={(n) => setTrainerRatings((p) => ({ ...p, [tr.id]: n }))}
              />
            </View>
          </SoftCard>
        ))}

        {ctx && (
          <Text
            onPress={() => setView(VIEW.DENUNCIAS)}
            accessibilityRole="button"
            style={styles.denunciasLink}
          >
            <FlagIcon size={13} color={globals.colors.danger} />
            {'  '}
            {k('denuncias')}
            {denunciaCount > 0 ? ` (${denunciaCount})` : ''}
          </Text>
        )}
        {loadFailed && <Text style={popupStyles.error}>{k('loadError')}</Text>}
      </>
    );
  } else if (view === VIEW.DENUNCIAS) {
    const count = (type) => Object.values(selected).filter((s) => s.type === type || (type === 'TRAINER' && s.type.startsWith('TRAINER'))).length;
    body = (
      <View style={popupStyles.stack}>
        {[
          [CATEGORY.TRAINER, ctx.trainersPresent.length, count('TRAINER')],
          [CATEGORY.MACHINE, ctx.machines.length, count('MACHINE_BROKEN')],
          [CATEGORY.MEMBER, ctx.members.length, count('MEMBER_MISCONDUCT')],
        ].map(([cat, available, picked]) => (
          <SoftCard
            key={cat}
            style={[popupStyles.gapSm, available === 0 && styles.disabled]}
            onPress={
              available === 0
                ? undefined
                : () => {
                    setCategory(cat);
                    setView(VIEW.CATEGORY);
                  }
            }
          >
            <Text style={styles.categoryText}>{k(`category.${cat}`)}</Text>
            {picked > 0 ? (
              <View style={popupStyles.row}>
                <CheckIcon size={14} />
                <Text style={styles.categoryCount}>{picked}</Text>
              </View>
            ) : (
              <ChevronRightIcon size={18} />
            )}
          </SoftCard>
        ))}
      </View>
    );
  } else {
    body = (
      <View style={[popupStyles.stack, popupStyles.gapMd]}>
        {category === CATEGORY.TRAINER &&
          ctx.trainersPresent.map((tr) => (
            <View key={tr.id} style={styles.trainerBlock}>
              <Text style={styles.name}>{tr.name}</Text>
              <CheckRow
                label={k('trainerMisconduct')}
                checked={Boolean(selected[denunciaKey('TRAINER_MISCONDUCT', tr.id)])}
                onPress={() => toggleDenuncia('TRAINER_MISCONDUCT', 'reportedUserId', tr.id)}
              />
              <CheckRow
                label={k('trainerFalseHelp')}
                checked={Boolean(selected[denunciaKey('TRAINER_FALSE_HELP', tr.id)])}
                onPress={() => toggleDenuncia('TRAINER_FALSE_HELP', 'reportedUserId', tr.id)}
              />
            </View>
          ))}
        {category === CATEGORY.MACHINE &&
          ctx.machines.map((m) => (
            <CheckRow
              key={m.id}
              label={m.zone ? `${m.name} (${m.zone})` : m.name}
              checked={Boolean(selected[denunciaKey('MACHINE_BROKEN', m.id)])}
              onPress={() => toggleDenuncia('MACHINE_BROKEN', 'machineId', m.id)}
            />
          ))}
        {category === CATEGORY.MEMBER &&
          ctx.members.map((m) => (
            <CheckRow
              key={m.id}
              label={m.name}
              checked={Boolean(selected[denunciaKey('MEMBER_MISCONDUCT', m.id)])}
              onPress={() => toggleDenuncia('MEMBER_MISCONDUCT', 'reportedUserId', m.id)}
            />
          ))}
      </View>
    );
  }

  const showHeader = !sent && !(!ctx && !loadFailed);
  return (
    <PopupModal
      onClose={onClose}
      closeLabel={k('close')}
      onBack={view !== VIEW.MAIN && !sent ? goBack : undefined}
      backLabel={k('back')}
    >
      {showHeader && (
        <View style={popupStyles.stack}>
          <Title align="left" style={view !== VIEW.MAIN ? styles.titleSub : null}>
            {titles[view]}
          </Title>
          {subtitles[view] ? <Subtitle align="left">{subtitles[view]}</Subtitle> : null}
        </View>
      )}
      <View style={popupStyles.stack}>{body}</View>
      {error ? <Text style={popupStyles.error}>{error}</Text> : null}
      {!sent && (ctx || loadFailed) ? (
        <PrimaryButton
          label={view === VIEW.MAIN ? k('send') : k('done')}
          onPress={view === VIEW.MAIN ? send : goBack}
          loading={sending}
          style={popupStyles.gapLg}
        />
      ) : null}
    </PopupModal>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: 30 },
  titleSub: { marginLeft: 26 },
  rateCard: { flexDirection: 'column', alignItems: 'center', paddingVertical: 14 },
  label: { color: globals.colors.text, fontSize: 12, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  name: { color: globals.colors.text, fontSize: 13, fontWeight: '800' },
  denunciasLink: { color: globals.colors.danger, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 18 },
  categoryText: { flex: 1, color: globals.colors.text, fontSize: 13, fontWeight: '700', paddingRight: 8 },
  categoryCount: { color: globals.colors.primary, fontWeight: '800', fontSize: 13, marginLeft: 4 },
  disabled: { opacity: 0.4 },
  trainerBlock: { marginBottom: 10 },
});
