// Live updates for the trainer and admin screens, through Ably.
//
// Instead of every phone asking the server "anything new?" every few seconds
// (which gets heavy when many people press "Pedir ayuda" at once), the Backend
// publishes one tiny signal on the "staff:live" channel whenever something
// changes ("help", "people", "conflicts", "routines", "reports") and the open
// screens re-read what they show. Signals carry no personal data.
//
// One connection is shared by the whole app: it opens when the first screen
// subscribes and closes when the last one goes away. If Ably is not available
// (not configured, no connection) `isStaffLive()` is false and useLiveLoad
// falls back to a slow refresh, so the screens keep working.

import Ably from 'ably';
import { apiClient } from '../apiClient/client';

const CHANNEL = 'staff:live';

let client = null;
let connected = false;
const topicHandlers = new Map(); // topic -> Set<fn>
const stateListeners = new Set();
let subscribers = 0;

function setConnected(next) {
  if (next === connected) return;
  connected = next;
  stateListeners.forEach((fn) => fn(connected));
}

function fireAll() {
  topicHandlers.forEach((handlers) => handlers.forEach((fn) => fn()));
}

function open() {
  if (client) return;
  client = new Ably.Realtime({
    // Ably asks again by itself before the token expires.
    authCallback: (_params, callback) => {
      apiClient
        .get('/staff/ably-token')
        .then((res) => callback(null, res.data))
        .catch((err) => callback(err, null));
    },
  });

  let wasConnected = false;
  client.connection.on((change) => {
    const isUp = change.current === 'connected';
    setConnected(isUp);
    // Signals can be missed while offline: re-read everything after a reconnect.
    if (isUp && wasConnected) fireAll();
    if (isUp) wasConnected = true;
  });

  client.channels.get(CHANNEL).subscribe((message) => {
    topicHandlers.get(message.name)?.forEach((fn) => {
      try {
        fn();
      } catch {
        // a bad handler must never break the subscription
      }
    });
  });
}

function close() {
  try {
    client?.close();
  } catch {
    // closing is best-effort
  }
  client = null;
  setConnected(false);
}

/** Calls `fn` every time one of `topics` changes. Returns the unsubscribe function. */
export function subscribeStaff(topics, fn) {
  topics.forEach((topic) => {
    if (!topicHandlers.has(topic)) topicHandlers.set(topic, new Set());
    topicHandlers.get(topic).add(fn);
  });
  subscribers += 1;
  open();

  return () => {
    topics.forEach((topic) => topicHandlers.get(topic)?.delete(fn));
    subscribers -= 1;
    if (subscribers <= 0) {
      subscribers = 0;
      close();
    }
  };
}

export const isStaffLive = () => connected;

/** Listens to the connection going up / down. Returns the unsubscribe function. */
export function onStaffLiveChange(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}
