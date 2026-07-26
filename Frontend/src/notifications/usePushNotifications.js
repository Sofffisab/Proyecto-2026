// src/notifications/usePushNotifications.js
//
// Wires the pieces in pushNotifications.js to the rest of the app:
//  1. Registers/refreshes the device's native push token with the Backend
//     (PATCH /users/me/fcm-token) whenever there's an authenticated session.
//  2. Shows the in-app "Tal necesita ayuda" pop-up when a HELP_REQUEST
//     message arrives while the app is foregrounded.
//  3. Navigates to the Trainer Help screen when the person taps the
//     notification (spec: "Acción al abrir: Redirige directamente a la
//     Pantalla Ayudar").

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHelpRequestAlert } from './HelpRequestAlertProvider';
import {
  attachPushListeners,
  registerDeviceForPush,
  resetPushRegistrationMemory,
} from './pushNotifications';

export default function usePushNotifications({ navigationRef, trainerHelpRoute }) {
  const { isAuthenticated, user } = useAuth();
  const { showHelpRequest } = useHelpRequestAlert();

  // (Re)register the token whenever we go from logged-out to logged-in,
  // and once per app boot if a persisted session was restored.
  useEffect(() => {
    if (isAuthenticated) {
      registerDeviceForPush();
    } else {
      resetPushRegistrationMemory();
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const detach = attachPushListeners({
      onHelpRequest: (data) => {
        // Only trainers act on this alert; a user account receiving one
        // (shouldn't normally happen) just ignores it.
        if (user?.role === 'TRAINER' || user?.role === 'trainer') {
          showHelpRequest(data);
        }
      },
      onNotificationTapped: (data) => {
        if (data.type === 'HELP_REQUEST' && navigationRef?.current?.isReady?.()) {
          navigationRef.current.navigate(trainerHelpRoute);
        }
      },
    });
    return detach;
  }, [navigationRef, trainerHelpRoute, showHelpRequest, user?.role]);
}
