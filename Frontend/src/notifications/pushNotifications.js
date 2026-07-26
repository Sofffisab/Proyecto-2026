// src/notifications/pushNotifications.js
//
// Client side of PATCH /users/me/fcm-token (Backend/src/services/
// pushNotification.service.js#sendTrainerAlert sends through firebase-admin
// directly to raw FCM/APNs tokens — NOT the Expo push token service — so we
// must fetch the *native device* push token (Notifications.getDevicePushTokenAsync),
// not Notifications.getExpoPushTokenAsync.
//
// This only works in a build that actually contains Google/Apple push
// credentials (see the "Manual native setup required" note in the PR
// description) — none of that can be generated from here, this module just
// wires the JS side so it starts working the moment those credentials exist.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as userApi from '../api/services/user.api';

// Data-only messages (see pushNotification.service.js — no `notification`
// block on purpose, so the app decides how to present it) don't get an
// automatic OS banner. We still ask the OS to show *something* for any
// message that reaches the device while the app is foregrounded, and let
// listeners in usePushNotifications.js react to the payload's `type`.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let listenersAttached = false;
let lastRegisteredToken = null;

/**
 * Requests OS permission and returns the native FCM (Android) / APNs (iOS)
 * device token, or null if permission was denied or this is running on a
 * simulator/web where push isn't supported.
 */
export async function getNativeDevicePushToken() {
  if (Platform.OS === 'web') return null;

  if (!Device.isDevice) {
    // Physical-device requirement from Expo docs: emulators/simulators
    // don't have a real push registration.
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    // Required so the "Tal necesita ayuda" alert can use a dedicated,
    // high-priority channel instead of the default one.
    await Notifications.setNotificationChannelAsync('trainer-alerts', {
      name: 'Trainer alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const { data } = await Notifications.getDevicePushTokenAsync(
      Platform.OS === 'ios' && projectId ? { projectId } : undefined
    );
    return data;
  } catch (err) {
    // Most common cause here: no google-services.json / GoogleService-Info.plist
    // bundled in this build yet, so the native push registration itself
    // fails before it ever reaches our code.
    console.warn('[push] Could not obtain native device push token:', err?.message);
    return null;
  }
}

/**
 * Registers (or re-registers) this device's token with the Backend.
 * Safe to call every time the app becomes authenticated (login, app
 * restart with a persisted session, etc.) — it no-ops if the token hasn't
 * changed since the last successful call in this app session.
 */
export async function registerDeviceForPush() {
  const token = await getNativeDevicePushToken();
  if (!token || token === lastRegisteredToken) return;

  try {
    await userApi.updateFcmToken(token);
    lastRegisteredToken = token;
  } catch (err) {
    console.warn('[push] Failed to send fcm token to backend:', err?.message);
  }
}

/**
 * Clears the local "already registered" memory (call on logout) so a
 * different account logging in on the same device re-sends its token.
 */
export function resetPushRegistrationMemory() {
  lastRegisteredToken = null;
}

/**
 * Attaches the two listeners expo-notifications exposes, exactly once for
 * the lifetime of the app:
 *  - onReceived: message arrived while the app is foregrounded.
 *  - onResponse: the person tapped the notification (foreground, background
 *    or the app was killed and this was the launch notification).
 * Returns an unsubscribe function.
 */
export function attachPushListeners({ onHelpRequest, onNotificationTapped }) {
  if (listenersAttached) return () => {};
  listenersAttached = true;

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification?.request?.content?.data || {};
    if (data.type === 'HELP_REQUEST') {
      onHelpRequest?.(data);
    }
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    onNotificationTapped?.(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
    listenersAttached = false;
  };
}
