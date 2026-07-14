import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/auth/LoginScreen';

import OnboardingScreen from '../screens/user/OnboardingScreen';
import SettingsScreen from '../screens/user/SettingsScreen';
import UserHomeScreen from '../screens/user/HomeScreen';
import HistoryScreen from '../screens/user/HistoryScreen';
import RoutinesScreen from '../screens/user/RoutinesScreen';
import AchievementsGoalsScreen from '../screens/user/AchievementsGoalsScreen';
import ReportsScreen from '../screens/user/ReportsScreen';
import WrappedScreen from '../screens/user/WrappedScreen';

import TrainerHomeScreen from '../screens/trainer/HomeScreen';
import TrainerHistoryScreen from '../screens/trainer/HistoryScreen';
import TrainerReportsScreen from '../screens/trainer/ReportsScreen';
import HelpScreen from '../screens/trainer/HelpScreen';

import AdminHomeScreen from '../screens/admin/HomeScreen';
import ViewGymScreen from '../screens/admin/ViewGymScreen';
import StatisticsScreen from '../screens/admin/StatisticsScreen';
import MembersScreen from '../screens/admin/MembersScreen';
import RewardsScreen from '../screens/admin/RewardsScreen';
import ReviewReportsScreen from '../screens/admin/ReviewReportsScreen';
import FullHistoryScreen from '../screens/admin/FullHistoryScreen';

/*
 * Route names for the whole navigation tree.
 *
 * It's a single Stack (there's no real backend/session yet, so there's no
 * per-role navigator split): the provisional Login shortcuts simply push
 * onto the main screen of whichever role you want to test, and from there
 * the rest of the screens are reached exactly as the user flow describes.
 * "Back" is always navigation.goBack().
 */
export const ROUTES = {
  LOGIN: 'Login',
  ONBOARDING: 'UserOnboarding',
  USER_SETTINGS: 'UserSettings',
  USER_HOME: 'UserHome',
  USER_HISTORY: 'UserHistory',
  USER_ROUTINES: 'UserRoutines',
  USER_ACHIEVEMENTS_GOALS: 'UserAchievementsGoals',
  USER_REPORTS: 'UserReports',
  USER_WRAPPED: 'UserWrapped',
  TRAINER_HOME: 'TrainerHome',
  TRAINER_HISTORY: 'TrainerHistory',
  TRAINER_REPORTS: 'TrainerReports',
  TRAINER_HELP: 'TrainerHelp',
  ADMIN_HOME: 'AdminHome',
  ADMIN_VIEW_GYM: 'AdminViewGym',
  ADMIN_STATISTICS: 'AdminStatistics',
  ADMIN_MEMBERS: 'AdminMembers',
  ADMIN_REWARDS: 'AdminRewards',
  ADMIN_REVIEW_REPORTS: 'AdminReviewReports',
  ADMIN_FULL_HISTORY: 'AdminFullHistory',
};

const Stack = createNativeStackNavigator();

// "Log out / switch account" doesn't have a confirmation pop-up implemented
// yet, so it goes straight back to the initial screen (popToTop, since
// Login is the first route in the stack).
const goToLogin = (navigation) => () => navigation.popToTop();
const goBack = (navigation) => () => navigation.goBack();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.LOGIN}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name={ROUTES.LOGIN}>
        {({ navigation }) => (
          <LoginScreen
            onLogin={async () => {
              // No backend connected yet: the real submit can't authenticate
              // anyone. Use the provisional shortcuts below.
              throw new Error('Backend not connected — use the provisional shortcuts below');
            }}
            onForgotPassword={undefined}
            onBack={undefined}
            onProvisionalNewUser={() => navigation.navigate(ROUTES.ONBOARDING)}
            onProvisionalUser={() => navigation.navigate(ROUTES.USER_HOME)}
            onProvisionalTrainer={() => navigation.navigate(ROUTES.TRAINER_HOME)}
            onProvisionalAdmin={() => navigation.navigate(ROUTES.ADMIN_HOME)}
          />
        )}
      </Stack.Screen>

      {/* ---------- User ---------- */}

      <Stack.Screen name={ROUTES.ONBOARDING}>
        {({ navigation }) => (
          <OnboardingScreen
            onBack={goBack(navigation)}
            onContinue={() => navigation.navigate(ROUTES.USER_SETTINGS)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_SETTINGS}>
        {({ navigation }) => (
          <SettingsScreen onSave={undefined} onBack={goBack(navigation)} />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_HOME}>
        {({ navigation }) => (
          <UserHomeScreen
            points={0}
            onScanQR={undefined}
            onGoToHistory={() => navigation.navigate(ROUTES.USER_HISTORY)}
            onGoToRoutines={() => navigation.navigate(ROUTES.USER_ROUTINES)}
            onGoToAchievementsGoals={() => navigation.navigate(ROUTES.USER_ACHIEVEMENTS_GOALS)}
            onGoToReports={() => navigation.navigate(ROUTES.USER_REPORTS)}
            onAskForHelp={undefined}
            onGoToSettings={() => navigation.navigate(ROUTES.USER_SETTINGS)}
            onGoToWrapped={() => navigation.navigate(ROUTES.USER_WRAPPED)}
            onLogout={goToLogin(navigation)}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_HISTORY}>
        {({ navigation }) => <HistoryScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_ROUTINES}>
        {({ navigation }) => <RoutinesScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_ACHIEVEMENTS_GOALS}>
        {({ navigation }) => <AchievementsGoalsScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_REPORTS}>
        {({ navigation }) => (
          <ReportsScreen onSubmit={undefined} onBack={goBack(navigation)} />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_WRAPPED}>
        {({ navigation }) => <WrappedScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      {/* ---------- Trainer ---------- */}

      <Stack.Screen name={ROUTES.TRAINER_HOME}>
        {({ navigation }) => (
          <TrainerHomeScreen
            onGenerateQR={undefined}
            onGoToHistory={() => navigation.navigate(ROUTES.TRAINER_HISTORY)}
            onGoToReports={() => navigation.navigate(ROUTES.TRAINER_REPORTS)}
            onGoToHelp={() => navigation.navigate(ROUTES.TRAINER_HELP)}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.TRAINER_HISTORY}>
        {({ navigation }) => <TrainerHistoryScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.TRAINER_REPORTS}>
        {({ navigation }) => (
          <TrainerReportsScreen onSubmit={undefined} onBack={goBack(navigation)} />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.TRAINER_HELP}>
        {({ navigation }) => (
          <HelpScreen onSelectUser={undefined} onBack={goBack(navigation)} />
        )}
      </Stack.Screen>

      {/* ---------- Admin ---------- */}

      <Stack.Screen name={ROUTES.ADMIN_HOME}>
        {({ navigation }) => (
          <AdminHomeScreen
            onGenerateQR={undefined}
            onGoToViewGym={() => navigation.navigate(ROUTES.ADMIN_VIEW_GYM)}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ADMIN_VIEW_GYM}>
        {({ navigation }) => (
          <ViewGymScreen
            onGoToStatistics={() => navigation.navigate(ROUTES.ADMIN_STATISTICS)}
            onGoToMembers={() => navigation.navigate(ROUTES.ADMIN_MEMBERS)}
            onGoToRewards={() => navigation.navigate(ROUTES.ADMIN_REWARDS)}
            onGoToReviewReports={() => navigation.navigate(ROUTES.ADMIN_REVIEW_REPORTS)}
            onGoToHistory={() => navigation.navigate(ROUTES.ADMIN_FULL_HISTORY)}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ADMIN_STATISTICS}>
        {({ navigation }) => <StatisticsScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ADMIN_MEMBERS}>
        {({ navigation }) => (
          <MembersScreen
            onCreateSession={undefined}
            onDeactivateAccount={undefined}
            onActivateAccount={undefined}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ADMIN_REWARDS}>
        {({ navigation }) => <RewardsScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ADMIN_REVIEW_REPORTS}>
        {({ navigation }) => <ReviewReportsScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ADMIN_FULL_HISTORY}>
        {({ navigation }) => <FullHistoryScreen onBack={goBack(navigation)} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
