// Trainer "Historial": who they helped and when. Static (see mockData.js);
// maps to GET /history/trainer-assistance.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import globals from '../../styles/globals';
import { useTranslation } from '../../i18n/I18nContext';
import ScreenBody from '../../components/trainer/ScreenBody';
import Avatar from '../../components/trainer/Avatar';
import { ASSISTANCE_HISTORY } from './mockData';

export default function TrainerHistoryScreen() {
  const { t } = useTranslation();
  return (
    <ScreenBody title={t('trainer.history.title')} subtitle={t('trainer.history.subtitle')}>
      {ASSISTANCE_HISTORY.map((h) => (
        <View key={h.id} style={styles.card}>
          <View style={styles.head}>
            <Avatar name={h.name} size={44} />
            <View style={styles.headTexts}>
              <Text style={styles.name} numberOfLines={1}>{h.name}</Text>
              <Text style={styles.caption}>{t('trainer.history.assistedOn', { date: h.date })}</Text>
            </View>
          </View>
          <View style={styles.details}>
            <Text style={styles.detail}>{t('trainer.history.machineLabel', { machine: h.machine })}</Text>
            <Text style={styles.detail}>{t('trainer.history.durationLabel', { minutes: h.minutes })}</Text>
            <Text style={[styles.detail, h.rating == null && styles.muted]}>
              {h.rating == null
                ? t('trainer.history.noRating')
                : t('trainer.history.ratingLabel', { rating: h.rating })}
            </Text>
          </View>
        </View>
      ))}
    </ScreenBody>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: globals.colors.surface,
    borderRadius: globals.radius.lg,
    borderWidth: 1,
    borderColor: globals.colors.surfaceBorder,
    padding: globals.spacing.md,
    marginBottom: globals.spacing.md,
    ...globals.shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  headTexts: { flex: 1, marginLeft: globals.spacing.md },
  name: { fontSize: globals.fontSize.md, fontWeight: '700', color: globals.colors.text },
  caption: { marginTop: 2, fontSize: globals.fontSize.sm, color: globals.colors.captionGrey },
  details: {
    marginTop: globals.spacing.md,
    paddingTop: globals.spacing.md,
    borderTopWidth: 1,
    borderTopColor: globals.colors.surfaceBorder,
    gap: 4,
  },
  detail: { fontSize: globals.fontSize.md, color: globals.colors.text },
  muted: { color: globals.colors.textSecondary },
});
