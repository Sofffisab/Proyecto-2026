import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal } from 'react-native';
import globals from '../../styles/globals';
import Header from '../../components/common/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Footer from '../../components/common/Footer';
import SocialInteractionPopup from './popups/SocialInteractionPopup';
import RateTrainerPopup from './popups/RateTrainerPopup';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Main Screen (User) - spec section 3.
 * Components: points counter, QR camera button, access to History,
 * Routines, Achievements & Goals, Reports, Ask for Help, Settings, Wrapped,
 * and log out / switch account.
 *
 * @param {number}   [points=0] - User's accumulated points.
 * @param {function} [onScanQR]
 * @param {function} [onGoToHistory]
 * @param {function} [onGoToRoutines]
 * @param {function} [onGoToAchievementsGoals]
 * @param {function} [onGoToReports] - navigates to the Reports Screen (spec section 3)
 * @param {function} [onAskForHelp]
 * @param {function} [onGoToSettings]
 * @param {function} [onGoToWrapped]
 * @param {function} [onLogout] - opens "are you sure?" pop-up
 * @param {function} [onBack]
 */
export default function HomeScreen({
  points = 0,
  onScanQR,
  onGoToHistory,
  onGoToRoutines,
  onGoToAchievementsGoals,
  onGoToReports,
  onAskForHelp,
  onGoToSettings,
  onGoToWrapped,
  onLogout,
  onBack,
}) {
  const { t } = useTranslation();
  // These 2 pop-ups appear at moments decided by the backend (random /
  // end of day), there's no real trigger button for them yet. They're
  // handled here as local state, since they're pop-ups (not screens)
  // and don't need their own entry in the navigation stack.
  const [showSocialInteraction, setShowSocialInteraction] = useState(false);
  const [showRateTrainer, setShowRateTrainer] = useState(false);

  return (
    <View style={styles.container}>
      <Header pageTitle={t('user.home.title')} subtitle={t('user.home.subtitle')} />

      <ScrollView style={styles.content}>
        <Card title={t('user.home.pointsAccumulated')} content={String(points)} />

        <View style={styles.buttonGroup}>
          <Button label={t('user.home.scanQR')} onPress={onScanQR} />
          <Button label={t('user.home.history')} onPress={onGoToHistory} variant="secondary" />
          <Button label={t('user.home.routines')} onPress={onGoToRoutines} variant="secondary" />
          <Button label={t('user.home.achievementsGoals')} onPress={onGoToAchievementsGoals} variant="secondary" />
          <Button label={t('user.home.reports')} onPress={onGoToReports} variant="secondary" />
          <Button label={t('user.home.pedirAyuda')} onPress={onAskForHelp} variant="secondary" />
          <Button label={t('user.home.settings')} onPress={onGoToSettings} variant="secondary" />
          <Button label={t('user.home.wrapped')} onPress={onGoToWrapped} variant="secondary" />
          <Button label={t('user.home.logout')} onPress={onLogout} variant="danger" />
        </View>

        {/* For testing: these pop-ups don't have a real trigger yet
            (the backend decides when to show them), so these buttons
            are added just to be able to see and test them. */}
        <View style={styles.buttonGroup}>
          <Button
            label={t('user.home.testSocialInteraction')}
            onPress={() => setShowSocialInteraction(true)}
            variant="secondary"
          />
          <Button
            label={t('user.home.testRateTrainer')}
            onPress={() => setShowRateTrainer(true)}
            variant="secondary"
          />
        </View>

        <Text style={styles.backLink} onPress={onBack}>{t('user.home.back')}</Text>
      </ScrollView>

      <Footer
        onNavigateHome={onBack}
        onNavigateProfile={onGoToSettings}
        onLogout={onLogout}
      />

      <Modal
        visible={showSocialInteraction}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSocialInteraction(false)}
      >
        <SocialInteractionPopup
          onNo={() => setShowSocialInteraction(false)}
          onYes={() => setShowSocialInteraction(false)}
          onClose={() => setShowSocialInteraction(false)}
        />
      </Modal>

      <Modal
        visible={showRateTrainer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRateTrainer(false)}
      >
        <RateTrainerPopup
          onRate={() => setShowRateTrainer(false)}
          onReportNotHelped={() => setShowRateTrainer(false)}
          onClose={() => setShowRateTrainer(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: globals.colors.background,
  },
  content: {
    flex: 1,
    padding: globals.spacing.md,
  },
  buttonGroup: {
    marginTop: globals.spacing.md,
  },
  backLink: {
    textAlign: 'center',
    color: globals.colors.textMuted,
    marginVertical: globals.spacing.lg,
  },
});
