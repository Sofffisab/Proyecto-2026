import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createNavigationContainerRef } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import globals from '../styles/globals';
import ROLES from '../constants/roles';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

import NotificationsScreen from '../screens/shared/NotificationsScreen';

import { OnboardingGoalScreen, OnboardingLevelScreen, OnboardingDaysScreen, OnboardingTypeScreen } from '../screens/user/OnboardingScreen';
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
import TrainerRoutineRequestsScreen from '../screens/trainer/RoutineRequestsScreen';
import TrainerGenerateQRScreen from '../screens/trainer/GenerateQRScreen';
import MachineConflictsScreen from '../screens/trainer/MachineConflictsScreen';

import AdminHomeScreen from '../screens/admin/HomeScreen';
import ViewGymScreen from '../screens/admin/ViewGymScreen';
import StatisticsScreen from '../screens/admin/StatisticsScreen';
import MembersScreen from '../screens/admin/MembersScreen';
import RewardsScreen from '../screens/admin/RewardsScreen';
import ReviewReportsScreen from '../screens/admin/ReviewReportsScreen';
import FullHistoryScreen from '../screens/admin/FullHistoryScreen';
import AdminGenerateQRScreen from '../screens/admin/GenerateQRScreen';

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
  WELCOME: 'Welcome',
  LOGIN: 'Login',
  FORGOT_PASSWORD: 'ForgotPassword',
  RESET_PASSWORD: 'ResetPassword',
  NOTIFICATIONS: 'Notifications',
  ONBOARDING_GOAL: 'UserOnboardingGoal',
  ONBOARDING_LEVEL: 'UserOnboardingLevel',
  ONBOARDING_DAYS: 'UserOnboardingDays',
  ONBOARDING_TYPE: 'UserOnboardingType',
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
  TRAINER_ROUTINE_REQUESTS: 'TrainerRoutineRequests',
  TRAINER_MACHINE_CONFLICTS: 'TrainerMachineConflicts',
  TRAINER_GENERATE_QR: 'TrainerGenerateQR',
  ADMIN_HOME: 'AdminHome',
  ADMIN_VIEW_GYM: 'AdminViewGym',
  ADMIN_STATISTICS: 'AdminStatistics',
  ADMIN_MEMBERS: 'AdminMembers',
  ADMIN_REWARDS: 'AdminRewards',
  ADMIN_REVIEW_REPORTS: 'AdminReviewReports',
  ADMIN_FULL_HISTORY: 'AdminFullHistory',
  ADMIN_GENERATE_QR: 'AdminGenerateQR',
};

const Stack = createNativeStackNavigator();

// Lets code outside the React tree (the push-notification "tapped" handler
// in src/notifications/pushNotifications.js) navigate — e.g. to jump
// straight to the Trainer Help screen per spec section 9.
export const navigationRef = createNavigationContainerRef();

// "Log out / switch account" now really logs out (clears the persisted
// session + blacklists the token server-side via AuthContext#logout) and
// then goes back to Welcome. Uses reset() instead of popToTop(): when a
// session was restored on launch, the stack starts directly on the role's
// Home screen (see initialRouteName below) and Welcome was never pushed,
// so popToTop() would just stay there instead of reaching Welcome.
const goToWelcome = (navigation) => () => {
  navigation.reset({ index: 0, routes: [{ name: ROUTES.WELCOME }] });
};
const goBack = (navigation) => () => navigation.goBack();

// Maps a real backend role (Backend/prisma/schema.prisma `Role` enum:
// USER | TRAINER | ADMIN) to the route of that role's home screen, and
// decides whether a USER needs the onboarding flow first (see
// Backend/src/middlewares/profileCompletion.middleware.js).
function getHomeRouteForUser(user) {
  if (!user) return ROUTES.WELCOME;
  if (user.role === ROLES.ADMIN.toUpperCase()) return ROUTES.ADMIN_HOME;
  if (user.role === ROLES.TRAINER.toUpperCase()) return ROUTES.TRAINER_HOME;
  return user.isProfileComplete ? ROUTES.USER_HOME : ROUTES.ONBOARDING_GOAL;
}

export default function RootNavigator() {
  const { isReady, isAuthenticated, user, login, logout, forgotPassword, verifyResetCode, resetPassword, changePassword, updateProfile, updateSettings } = useAuth();

  // While a persisted session is being restored from AsyncStorage, avoid
  // flashing the Login screen — show a lightweight loader instead.
  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: globals.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={globals.colors.primary} />
      </View>
    );
  }

  // If a valid session was restored, skip straight to that role's home
  // screen instead of Welcome. The provisional shortcuts still work from
  // Login for testing every role/flow without a real account.
  const initialRouteName = isAuthenticated ? getHomeRouteForUser(user) : ROUTES.WELCOME;

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name={ROUTES.WELCOME}>
        {({ navigation }) => (
          <WelcomeScreen
            onIniciarSesion={() => navigation.navigate(ROUTES.LOGIN)}
            // "Nuevo usuario" (mockup: IniciarSesionn.html): no hay
            // auto-registro en el Backend (ver Backend/src/api/services/auth.api.js,
            // las cuentas las crea un admin/trainer), así que por ahora
            // queda sin acción, igual que "forgot password" en LoginScreen
            // antes de tener su pantalla — static, no logic.
            onNuevoUsuario={undefined}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.LOGIN}>
        {({ navigation }) => (
          <LoginScreen
            onLogin={async (email, password) => {
              // Real authentication: POST /auth/login (see
              // Backend/src/controllers/auth.controller.js#login).
              const loggedInUser = await login(email, password);
              navigation.reset({
                index: 0,
                routes: [{ name: getHomeRouteForUser(loggedInUser) }],
              });
            }}
            onForgotPassword={() => navigation.navigate(ROUTES.FORGOT_PASSWORD)}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.FORGOT_PASSWORD}>
        {({ navigation }) => (
          <ForgotPasswordScreen
            onSubmit={async (email) => {
              // POST /auth/forgot-password (see
              // Backend/src/controllers/auth.controller.js#forgotPassword).
              await forgotPassword(email);
            }}
            onVerifyCode={async (email, code) => {
              // POST /auth/verify-reset-code (see
              // Backend/src/controllers/auth.controller.js#verifyResetCode).
              await verifyResetCode({ email, code });
            }}
            onGoToReset={(token) => navigation.navigate(ROUTES.RESET_PASSWORD, { token })}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.RESET_PASSWORD}>
        {({ navigation, route }) => (
          <ResetPasswordScreen
            initialToken={route.params?.token}
            onSubmit={async ({ token, newPassword }) => {
              // POST /auth/reset-password (see
              // Backend/src/controllers/auth.controller.js#resetPassword).
              // Note: this is the Backend's only real validation point for
              // the code/token — there is no separate "verify code" endpoint,
              // so an invalid/expired code only surfaces as an error here.
              await resetPassword({ token, newPassword });
            }}
            onDone={() => navigation.popToTop()}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      {/* ---------- Shared ---------- */}

      <Stack.Screen name={ROUTES.NOTIFICATIONS}>
        {({ navigation }) => <NotificationsScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      {/* ---------- User ---------- */}

      <Stack.Screen name={ROUTES.ONBOARDING_GOAL}>
        {({ navigation, route }) => (
          <OnboardingGoalScreen
            onBack={goBack(navigation)}
            value={route.params?.mainGoal ?? null}
            onSelect={(v) => navigation.setParams({ mainGoal: v })}
            onContinue={() => {
              navigation.navigate(ROUTES.ONBOARDING_LEVEL, { mainGoal: route.params?.mainGoal });
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ONBOARDING_LEVEL}>
        {({ navigation, route }) => (
          <OnboardingLevelScreen
            onBack={goBack(navigation)}
            value={route.params?.currentLevel ?? null}
            onSelect={(v) => navigation.setParams({ currentLevel: v })}
            onContinue={() => {
              const { mainGoal, currentLevel } = route.params ?? {};
              navigation.navigate(ROUTES.ONBOARDING_DAYS, { mainGoal, currentLevel });
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ONBOARDING_DAYS}>
        {({ navigation, route }) => (
          <OnboardingDaysScreen
            onBack={goBack(navigation)}
            value={route.params?.daysPerWeek ?? null}
            onSelect={(v) => navigation.setParams({ daysPerWeek: v })}
            onContinue={() => {
              const { mainGoal, currentLevel, daysPerWeek } = route.params ?? {};
              navigation.navigate(ROUTES.ONBOARDING_TYPE, { mainGoal, currentLevel, daysPerWeek });
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.ONBOARDING_TYPE}>
        {({ navigation, route }) => {
          const [saving, setSaving] = React.useState(false);
          const [error, setError] = React.useState(null);
          const { mainGoal, currentLevel, daysPerWeek } = route.params ?? {};
          return (
            <OnboardingTypeScreen
              onBack={goBack(navigation)}
              value={route.params?.trainingType ?? null}
              onSelect={(v) => navigation.setParams({ trainingType: v })}
              loading={saving}
              error={error}
              onContinue={async () => {
                const trainingType = route.params?.trainingType;
                setSaving(true);
                setError(null);
                try {
                  // Saves objectives/trainingLevel/weeklyTrainingDays/trainingType
                  // via PUT /users/me, then moves on to the remaining required
                  // fields (birthday, medicalConditions, deliveryAddress) in
                  // Settings — see profileCompletion.middleware.js for why both
                  // steps are needed before the profile counts as complete.
                  await updateProfile({
                    objectives: [mainGoal],
                    trainingLevel: currentLevel,
                    weeklyTrainingDays: daysPerWeek,
                    trainingType,
                  });
                  navigation.navigate(ROUTES.USER_SETTINGS);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setSaving(false);
                }
              }}
            />
          );
        }}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_SETTINGS}>
        {({ navigation }) => (
          <SettingsScreen
            email={user?.email ?? ''}
            age={user?.age ?? null}
            initialValues={{
              medicalConditions: Array.isArray(user?.medicalConditions)
                ? user.medicalConditions.join(', ')
                : '',
              dateOfBirth: user?.birthday ? String(user.birthday).slice(0, 10) : '',
              exactAddress: user?.deliveryAddress ?? '',
              disableAssistance: user?.settings?.disableAssistance ?? false,
              machineTrackingOptOut: user?.settings?.machineTrackingOptOut ?? false,
            }}
            onChangePassword={async ({ currentPassword, newPassword }) => {
              // PATCH /users/me/password (see
              // Backend/src/controllers/user.controller.js#changePassword).
              await changePassword({ currentPassword, newPassword });
            }}
            onSave={async (payload) => {
              // PUT /users/me for profile fields, PATCH /users/me/settings
              // for preferences — two separate Backend resources (see
              // Backend/src/routes/index.js "USERS ROUTES").
              const updatedUser = await updateProfile({
                medicalConditions: payload.medicalConditions,
                birthday: payload.birthday,
                deliveryAddress: payload.deliveryAddress,
              });
              await updateSettings({
                disableAssistance: payload.disableAssistance,
                machineTrackingOptOut: payload.machineTrackingOptOut,
              });

              // First-time completion (coming from Onboarding): once the
              // profile is complete, go straight to Home instead of back
              // to Onboarding. Otherwise (editing from Home), just return.
              if (updatedUser.isProfileComplete) {
                navigation.reset({ index: 0, routes: [{ name: ROUTES.USER_HOME }] });
              } else {
                goBack(navigation)();
              }
            }}
            onBack={goBack(navigation)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.USER_HOME}>
        {({ navigation }) => (
          <UserHomeScreen
            onGoToHistory={() => navigation.navigate(ROUTES.USER_HISTORY)}
            onGoToRoutines={() => navigation.navigate(ROUTES.USER_ROUTINES)}
            onGoToAchievementsGoals={() => navigation.navigate(ROUTES.USER_ACHIEVEMENTS_GOALS)}
            onGoToReports={() => navigation.navigate(ROUTES.USER_REPORTS)}
            onGoToSettings={() => navigation.navigate(ROUTES.USER_SETTINGS)}
            onGoToWrapped={() => navigation.navigate(ROUTES.USER_WRAPPED)}
            onGoToNotifications={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
            onLogout={async () => {
              // POST /auth/logout blacklists the token server-side (see
              // Backend/src/services/auth.service.js#logout) and clears
              // the persisted session locally.
              await logout();
              goToWelcome(navigation)();
            }}
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
            onGenerateQR={() => navigation.navigate(ROUTES.TRAINER_GENERATE_QR)}
            onGoToHistory={() => navigation.navigate(ROUTES.TRAINER_HISTORY)}
            onGoToReports={() => navigation.navigate(ROUTES.TRAINER_REPORTS)}
            onGoToHelp={() => navigation.navigate(ROUTES.TRAINER_HELP)}
            onGoToRoutineRequests={() => navigation.navigate(ROUTES.TRAINER_ROUTINE_REQUESTS)}
            onGoToMachineConflicts={() => navigation.navigate(ROUTES.TRAINER_MACHINE_CONFLICTS)}
            onGoToNotifications={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
            onLogout={async () => {
              await logout();
              goToWelcome(navigation)();
            }}
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

      <Stack.Screen name={ROUTES.TRAINER_ROUTINE_REQUESTS}>
        {({ navigation }) => <TrainerRoutineRequestsScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.TRAINER_MACHINE_CONFLICTS}>
        {({ navigation }) => <MachineConflictsScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      <Stack.Screen name={ROUTES.TRAINER_GENERATE_QR}>
        {({ navigation }) => <TrainerGenerateQRScreen onBack={goBack(navigation)} />}
      </Stack.Screen>

      {/* ---------- Admin ---------- */}

      <Stack.Screen name={ROUTES.ADMIN_HOME}>
        {({ navigation }) => (
          <AdminHomeScreen
            onGenerateQR={() => navigation.navigate(ROUTES.ADMIN_GENERATE_QR)}
            onGoToViewGym={() => navigation.navigate(ROUTES.ADMIN_VIEW_GYM)}
            onGoToNotifications={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
            onLogout={async () => {
              await logout();
              goToWelcome(navigation)();
            }}
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
          // MembersScreen fetches/mutates its own data (GET /users, POST
          // /auth/users, PATCH /users/:id/status) via user.api.js/auth.api.js.
          <MembersScreen onBack={goBack(navigation)} />
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

      <Stack.Screen name={ROUTES.ADMIN_GENERATE_QR}>
        {({ navigation }) => <AdminGenerateQRScreen onBack={goBack(navigation)} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
