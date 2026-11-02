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
// Same look as SocialInteractionPopup (teal header, white body, ✕ to close).
// Denuncias end up in the `denuncias` table (Backend/src/services/denuncia.service.js).

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as gymApi from '../../features/api/services/gym.api';

const STARS = [1, 2, 3, 4, 5];
const VIEW = { MAIN: 'MAIN', DENUNCIAS: 'DENUNCIAS', CATEGORY: 'CATEGORY' };
const CATEGORY = { TRAINER: 'TRAINER', MACHINE: 'MACHINE', MEMBER: 'MEMBER' };

const denunciaKey = (type, id) => `${type}:${id}`;

function Stars({ value, onChange, size = 28 }) {
  return (
    <View style={styles.starsRow}>
      {STARS.map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Text style={[styles.star, { fontSize: size }, n <= value && styles.starOn]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Check({ checked, label, onPress }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

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

  let body;
  if (sent) {
    body = <Text style={styles.bigNote}>{k('thanks')}</Text>;
  } else if (!ctx && !loadFailed) {
    body = <ActivityIndicator color={globals.colors.primary} />;
  } else if (view === VIEW.MAIN) {
    body = (
      <>
        <Text style={styles.label}>{k('rateDay')}</Text>
        <Stars value={dayRating} onChange={setDayRating} size={34} />

        {toRate.length > 0 && <Text style={[styles.label, styles.gap]}>{k('rateTrainers')}</Text>}
        {toRate.map((tr) => (
          <View key={tr.id} style={styles.trainerBlock}>
            <Text style={styles.name}>{tr.name}</Text>
            <Stars value={trainerRatings[tr.id] ?? 0} onChange={(n) => setTrainerRatings((p) => ({ ...p, [tr.id]: n }))} />
          </View>
        ))}

        {ctx && (
          <TouchableOpacity style={styles.denunciasButton} onPress={() => setView(VIEW.DENUNCIAS)}>
            <Text style={styles.denunciasButtonText}>
              {k('denuncias')}
              {denunciaCount > 0 ? ` (${denunciaCount})` : ''}
            </Text>
          </TouchableOpacity>
        )}
        {loadFailed && <Text style={styles.errorText}>{k('loadError')}</Text>}
      </>
    );
  } else if (view === VIEW.DENUNCIAS) {
    const count = (type) => Object.values(selected).filter((s) => s.type === type || (type === 'TRAINER' && s.type.startsWith('TRAINER'))).length;
    body = (
      <>
        {[
          [CATEGORY.TRAINER, ctx.trainersPresent.length, count('TRAINER')],
          [CATEGORY.MACHINE, ctx.machines.length, count('MACHINE_BROKEN')],
          [CATEGORY.MEMBER, ctx.members.length, count('MEMBER_MISCONDUCT')],
        ].map(([cat, available, picked]) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryRow, available === 0 && styles.disabled]}
            disabled={available === 0}
            onPress={() => {
              setCategory(cat);
              setView(VIEW.CATEGORY);
            }}
          >
            <Text style={styles.categoryText}>{k(`category.${cat}`)}</Text>
            <Text style={styles.categoryCount}>{picked > 0 ? `✓ ${picked}` : '›'}</Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.hint}>{k('denunciasHint')}</Text>
      </>
    );
  } else {
    body = (
      <ScrollView style={styles.list}>
        {category === CATEGORY.TRAINER &&
          ctx.trainersPresent.map((tr) => (
            <View key={tr.id} style={styles.trainerBlock}>
              <Text style={styles.name}>{tr.name}</Text>
              <Check
                label={k('trainerMisconduct')}
                checked={Boolean(selected[denunciaKey('TRAINER_MISCONDUCT', tr.id)])}
                onPress={() => toggleDenuncia('TRAINER_MISCONDUCT', 'reportedUserId', tr.id)}
              />
              <Check
                label={k('trainerFalseHelp')}
                checked={Boolean(selected[denunciaKey('TRAINER_FALSE_HELP', tr.id)])}
                onPress={() => toggleDenuncia('TRAINER_FALSE_HELP', 'reportedUserId', tr.id)}
              />
            </View>
          ))}
        {category === CATEGORY.MACHINE &&
          ctx.machines.map((m) => (
            <Check
              key={m.id}
              label={m.zone ? `${m.name} (${m.zone})` : m.name}
              checked={Boolean(selected[denunciaKey('MACHINE_BROKEN', m.id)])}
              onPress={() => toggleDenuncia('MACHINE_BROKEN', 'machineId', m.id)}
            />
          ))}
        {category === CATEGORY.MEMBER &&
          ctx.members.map((m) => (
            <Check
              key={m.id}
              label={m.name}
              checked={Boolean(selected[denunciaKey('MEMBER_MISCONDUCT', m.id)])}
              onPress={() => toggleDenuncia('MEMBER_MISCONDUCT', 'reportedUserId', m.id)}
            />
          ))}
      </ScrollView>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            {view !== VIEW.MAIN && !sent ? (
              <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.backX}>
                <Text style={styles.headerIcon}>‹</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.headerText}>{titles[view]}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={k('close')} style={styles.closeX}>
              <Text style={styles.headerIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {body}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {!sent && (
            <View style={styles.footer}>
              {view === VIEW.MAIN ? (
                <TouchableOpacity style={styles.button} onPress={send} disabled={sending} activeOpacity={0.8}>
                  {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{k('send')}</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.button} onPress={goBack} activeOpacity={0.8}>
                  <Text style={styles.buttonText}>{k('done')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: globals.spacing.md },
  card: { width: '100%', maxWidth: 380, maxHeight: '90%', backgroundColor: globals.colors.background, borderRadius: globals.radius.sm, overflow: 'hidden' },
  header: { backgroundColor: globals.colors.primary, paddingVertical: globals.spacing.md, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  headerIcon: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  closeX: { position: 'absolute', top: 10, right: 12 },
  backX: { position: 'absolute', top: 8, left: 12 },
  body: { paddingVertical: globals.spacing.lg, paddingHorizontal: globals.spacing.lg, alignItems: 'stretch' },
  footer: { paddingHorizontal: globals.spacing.lg, paddingBottom: globals.spacing.lg },
  label: { color: globals.colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: globals.spacing.sm },
  gap: { marginTop: globals.spacing.lg },
  starsRow: { flexDirection: 'row', justifyContent: 'center' },
  star: { color: globals.colors.border, marginHorizontal: 3 },
  starOn: { color: globals.colors.primary },
  trainerBlock: { marginBottom: globals.spacing.md },
  name: { color: globals.colors.text, fontSize: 13, textAlign: 'center', marginBottom: 4 },
  denunciasButton: { marginTop: globals.spacing.lg, paddingVertical: 10, borderRadius: globals.radius.sm, borderWidth: 1, borderColor: globals.colors.danger, alignItems: 'center' },
  denunciasButtonText: { color: globals.colors.danger, fontWeight: '700', fontSize: 13 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: globals.colors.border },
  categoryText: { color: globals.colors.text, fontSize: 14 },
  categoryCount: { color: globals.colors.primary, fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.4 },
  hint: { marginTop: globals.spacing.md, color: globals.colors.textMuted, fontSize: 11, textAlign: 'center' },
  list: { maxHeight: 320 },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  box: { width: 20, height: 20, borderWidth: 1, borderColor: globals.colors.border, borderRadius: 4, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: globals.colors.primary, borderColor: globals.colors.primary },
  tick: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  checkLabel: { color: globals.colors.text, fontSize: 13, flex: 1 },
  button: { backgroundColor: globals.colors.primary, paddingVertical: 12, borderRadius: globals.radius.sm, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  bigNote: { color: globals.colors.primary, fontSize: globals.fontSize.lg, fontWeight: '700', textAlign: 'center' },
  errorText: { color: globals.colors.danger, fontSize: 12, textAlign: 'center', marginTop: globals.spacing.sm },
});
