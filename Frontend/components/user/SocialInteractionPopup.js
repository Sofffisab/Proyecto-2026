// src/components/user/SocialInteractionPopup.js
//
// The "¿Querés hacer un amigo en el gimnasio?" pop-ups. Purely presentational:
// it renders the `view` that social/SocialContext.js keeps (see
// social/socialReducer.js for the phases) and reports what the person pressed.
//
//   ASK / (ASK_ACCEPTED)  invitation            [Sí, quiero] [Ahora no]
//   ASK_ACCEPTED          "Buscando un amigo…" spinner (5 s, then it closes)
//   SCAN / QR             "¡Encontramos a tu amigo!" + friend card (tap → profile)
//                         [Escanear QR] -> camera      [Mostrar QR] -> my QR
//   CAMERA                camera, scanning their QR
//   DONE                  "¿Cómo fue tu experiencia?"  stars / 👍👎 / Denunciar
//   CANCELLED / EXPIRED / ERROR   short result message
//
// The QR is the person's own signed QR (GET /qr/me), fetched once when it is
// shown. The camera is the app's normal QRScanner. Look & feel: PopupKit.js
// (shared with the exit pop-up).

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import * as qrApi from '../../features/api/services/qr.api';
import QRScanner from '../common/QRScanner';
import { PHASE, isVisible, PAIRING_PHASES } from '../../social/socialReducer';
import {
  PopupModal,
  Hero,
  HERO,
  SoftCircle,
  Spinner,
  Title,
  Subtitle,
  PrimaryButton,
  OutlineButton,
  SoftCard,
  Avatar,
  ChevronRightIcon,
  Stars,
  ThumbButton,
  FlagIcon,
  popupStyles,
} from '../common/PopupKit';

const { colors } = globals;

const formatTime = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
};

/** Seconds left until `deadline`, re-rendered once a second while `enabled`. */
function useTimeLeft(deadline, enabled) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled, deadline]);
  return Math.max(0, (deadline ?? 0) - now);
}

/** "¿Cómo fue tu experiencia?" — everything optional. */
function FeedbackCard({ view, name, tk, onSend, onClose }) {
  const [rating, setRating] = useState(0);
  const [liked, setLiked] = useState(null); // true | false | null
  const [report, setReport] = useState(false);

  return (
    <PopupModal onClose={onClose} closeLabel={tk('close')}>
      {view.points > 0 ? (
        <View style={styles.pointsPill}>
          <Text style={styles.pointsText}>{tk('donePoints', { points: view.points })}</Text>
        </View>
      ) : null}
      <Title align="left">{tk('feedbackTitle')}</Title>
      <Subtitle align="left">{tk('feedbackBody', { name })}</Subtitle>

      <SoftCard style={[popupStyles.gapMd, styles.feedbackBox]}>
        <View style={popupStyles.row}>
          <Avatar />
          <Text style={[styles.friendName, { marginLeft: 10 }]}>{name}</Text>
        </View>

        <View style={styles.starsWrap}>
          <Stars value={rating} onChange={setRating} size={28} />
          <Text style={[popupStyles.muted, styles.optional]}>{tk('optional')}</Text>
        </View>

        <View style={styles.thumbsRow}>
          <ThumbButton up selected={liked === true} onPress={() => setLiked(liked === true ? null : true)} label={tk('like')} />
          <View style={{ width: 14 }} />
          <ThumbButton selected={liked === false} onPress={() => setLiked(liked === false ? null : false)} label={tk('dislike')} />
        </View>

        <TouchableOpacity
          style={styles.reportWrap}
          onPress={() => setReport((r) => !r)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: report }}
        >
          <FlagIcon size={16} color={colors.danger} fill={report ? colors.danger : 'none'} />
          <Text style={styles.reportText}>{report ? tk('reported') : tk('report')}</Text>
        </TouchableOpacity>
      </SoftCard>

      <PrimaryButton
        label={tk('send')}
        onPress={() => onSend?.({ rating, liked, report })}
        style={popupStyles.gapMd}
      />
    </PopupModal>
  );
}

/**
 * @param {object|null} view  current pop-up state ({ id, phase, deadline, points, scanError, partner })
 * @param {function} onAccept     "Sí, quiero"
 * @param {function} onDecline    "Ahora no" or the ✕ (cancels whatever is in progress)
 * @param {function} onOpenCamera "Escanear QR"
 * @param {function} onScanned    (rawQrString) => void
 * @param {function} onFeedback   ({ rating, liked, report }) => void — closes the pop-up
 */
export default function SocialInteractionPopup({ view, onAccept, onDecline, onOpenCamera, onScanned, onFeedback }) {
  const { t } = useTranslation();
  const tk = (name, params) => t(`user.popups.socialInteraction.${name}`, params);

  const phase = view?.phase;
  const pairing = PAIRING_PHASES.includes(phase);
  const timeLeft = useTimeLeft(view?.deadline, pairing);

  // Sub-screens of the pairing stage (kept here: they are pure presentation).
  const [showQr, setShowQr] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  useEffect(() => {
    setShowQr(false);
    setShowProfile(false);
  }, [view?.id]);

  // Own QR, requested only when this person is the one who shows it.
  const [qrPayload, setQrPayload] = useState(null);
  const qrVisible = phase === PHASE.QR && showQr;
  useEffect(() => {
    if (!qrVisible) return undefined;
    let cancelled = false;
    qrApi
      .getMyQR()
      .then((res) => {
        if (!cancelled) setQrPayload(JSON.stringify(res.data));
      })
      .catch(() => {
        if (!cancelled) setQrPayload(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrVisible, view?.id]);

  if (!isVisible(view)) return null;

  const close = onDecline;
  const closeLabel = tk('close');
  const partner = view.partner ?? null;
  const name = partner?.name || tk('friendFallback');
  const timer = <Text style={[popupStyles.muted, styles.timer]}>{tk('timeLeft', { time: formatTime(timeLeft) })}</Text>;

  // ── invitation ──────────────────────────────────────────────────────
  if (phase === PHASE.ASK) {
    return (
      <PopupModal onClose={close} closeLabel={closeLabel}>
        <Hero source={HERO.friend} />
        <Title>{tk('question')}</Title>
        <Subtitle>{tk('questionBody')}</Subtitle>
        <PrimaryButton label={tk('yes')} onPress={onAccept} style={popupStyles.gapLg} />
        <OutlineButton label={tk('no')} onPress={onDecline} style={popupStyles.gapSm} />
      </PopupModal>
    );
  }

  // ── "Buscando un amigo…" (5 s after pressing Sí) ────────────────────
  if (phase === PHASE.ASK_ACCEPTED) {
    return (
      <PopupModal onClose={close} closeLabel={closeLabel}>
        <SoftCircle>
          <Spinner />
        </SoftCircle>
        <Title>{tk('searching')}</Title>
        <Subtitle>{tk('searchingBody')}</Subtitle>
      </PopupModal>
    );
  }

  // ── friend profile (tap on the friend card) ─────────────────────────
  if (pairing && showProfile && phase !== PHASE.CAMERA) {
    const interests = [
      ...(partner?.interests ?? []).map((k) => tk(`interest.${k}`)),
      ...(partner?.level ? [tk(`level.${partner.level}`)] : []),
    ];
    const goals = [
      ...(partner?.goals ?? []).map((k) => tk(`goal.${k}`)),
      ...(partner?.achievements > 0 ? [tk(partner.achievements === 1 ? 'achievementsOne' : 'achievementsMany', { count: partner.achievements })] : []),
    ];
    const range = partner?.ageRange ? tk('ageRangeValue', partner.ageRange) : null;
    const Section = ({ label, value }) => (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{label}</Text>
        <Text style={styles.sectionValue}>{value || tk('noInfo')}</Text>
      </View>
    );
    return (
      <PopupModal onClose={close} closeLabel={closeLabel} onBack={() => setShowProfile(false)} backLabel={tk('back')}>
        <View style={styles.profileHead}>
          <Avatar size={38} />
          <Text style={styles.profileName}>{name}</Text>
        </View>
        <Section label={tk('interests')} value={interests.join(' · ')} />
        <Section label={tk('goalsAndAchievements')} value={goals.join(' · ')} />
        <Section label={tk('ageRange')} value={range} />
      </PopupModal>
    );
  }

  // ── "¡Encontramos a tu amigo!" ──────────────────────────────────────
  if ((phase === PHASE.SCAN || (phase === PHASE.QR && !showQr))) {
    const isQr = phase === PHASE.QR;
    return (
      <PopupModal onClose={close} closeLabel={closeLabel}>
        <Hero source={HERO.found} width={92} height={50} />
        <Title>{tk('found')}</Title>
        {view.scanError ? <Text style={popupStyles.error}>{tk('wrongQr')}</Text> : null}
        <SoftCard onPress={() => setShowProfile(true)} style={popupStyles.gapMd}>
          <Avatar />
          <View style={styles.friendText}>
            <Text style={styles.friendName}>{name}</Text>
            <Text style={styles.friendLine}>
              {partner?.machine ? tk('trainingAt') : tk('inGym')}
            </Text>
            {partner?.machine ? <Text style={styles.friendMachine}>{partner.machine}</Text> : null}
          </View>
          <ChevronRightIcon size={18} />
        </SoftCard>
        <PrimaryButton
          label={isQr ? tk('showQr') : tk('scanQr')}
          onPress={isQr ? () => setShowQr(true) : onOpenCamera}
          style={popupStyles.gapMd}
        />
        {timer}
      </PopupModal>
    );
  }

  // ── camera ──────────────────────────────────────────────────────────
  if (phase === PHASE.CAMERA) {
    return (
      <PopupModal onClose={close} closeLabel={closeLabel}>
        <Title>{tk('scanTitle')}</Title>
        <Subtitle>{tk('scanBody', { name })}</Subtitle>
        <View style={[styles.cameraBox, popupStyles.gapMd]}>
          <QRScanner onScanned={onScanned} />
        </View>
        {timer}
      </PopupModal>
    );
  }

  // ── my QR ───────────────────────────────────────────────────────────
  if (phase === PHASE.QR) {
    return (
      <PopupModal onClose={close} closeLabel={closeLabel} onBack={() => setShowQr(false)} backLabel={tk('back')}>
        <Title>{tk('showTitle')}</Title>
        <Subtitle>{tk('showBody', { name })}</Subtitle>
        <View style={[styles.qrBox, popupStyles.gapMd]}>
          {qrPayload ? <QRCode value={qrPayload} size={190} /> : <ActivityIndicator color={colors.primary} />}
        </View>
        {timer}
      </PopupModal>
    );
  }

  // ── done: "¿Cómo fue tu experiencia?" ───────────────────────────────
  if (phase === PHASE.DONE) {
    return (
      <FeedbackCard
        view={view}
        name={name}
        tk={tk}
        onClose={() => onFeedback?.(null)}
        onSend={onFeedback}
      />
    );
  }

  // ── short result messages ───────────────────────────────────────────
  const message =
    phase === PHASE.CANCELLED
      ? [tk('cancelledTitle'), view.points > 0 ? tk('cancelledPoints', { points: view.points }) : null]
      : phase === PHASE.EXPIRED
        ? [tk('expiredTitle'), tk('expiredBody')]
        : [tk('error'), null];
  return (
    <PopupModal onClose={close} closeLabel={closeLabel}>
      <Title>{message[0]}</Title>
      {message[1] ? <Subtitle>{message[1]}</Subtitle> : null}
    </PopupModal>
  );
}

const styles = StyleSheet.create({
  friendText: { flex: 1, marginLeft: 10 },
  friendName: { color: colors.text, fontSize: 13, fontWeight: '800', marginLeft: 0 },
  friendLine: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
  friendMachine: { color: colors.text, fontSize: 11, fontWeight: '800', marginTop: 2 },
  timer: { marginTop: 12 },
  cameraBox: {
    alignSelf: 'stretch',
    height: 250,
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: '#000',
  },
  qrBox: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 8,
    minHeight: 220,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHead: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 18 },
  profileName: { color: colors.text, fontSize: 15, fontWeight: '800', marginLeft: 10 },
  section: { alignSelf: 'stretch', marginBottom: 14 },
  sectionLabel: { color: colors.text, fontSize: 11, fontWeight: '800' },
  sectionValue: { color: colors.text, fontSize: 11, marginTop: 3, lineHeight: 16 },
  pointsPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealSoft,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  pointsText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  feedbackBox: { flexDirection: 'column', alignItems: 'stretch' },
  starsWrap: { marginTop: 14, alignItems: 'center' },
  optional: { marginTop: 4 },
  thumbsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  reportWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  reportText: { color: colors.danger, fontSize: 11, fontWeight: '700', marginLeft: 6 },
});
