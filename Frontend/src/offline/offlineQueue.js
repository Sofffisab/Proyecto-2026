// src/offline/offlineQueue.js
//
// Silent offline queue for gym-presence actions (check-in/check-out/
// machine start/end), backed by AsyncStorage and flushed through
// POST /sync (sync.api.js). No UI: per the product requirement, offline
// support should work transparently in the background, not be surfaced
// to the user.
//
// Scope note: this module provides the queue + flush primitives, and
// flushQueue() is called opportunistically (see HomeScreen's focus
// effect) so anything already queued gets synced next time the user has
// a connection. It does NOT reimplement QR-payload parsing (i.e. it
// can't itself decide "this scanned MACHINE QR means a machineStart
// event") — that logic lives server-side in
// verification.service.js#processScan and intentionally isn't duplicated
// on the client to avoid two sources of truth. Screens that want true
// offline capture should call `queueAction()` directly with an
// already-known action type (e.g. a manual check-in button), rather than
// from the generic QR scanner.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as syncApi from '../api/services/sync.api';

const QUEUE_KEY = 'offlineActionQueue';

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue) {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Best-effort; if storage itself is failing there's nothing more we
    // can do here without surfacing UI, which is explicitly out of scope.
  }
}

/**
 * Queues an action locally. `type` must be one of 'checkin' | 'checkout' |
 * 'machineStart' | 'machineEnd' (matches Backend's syncActionSchema).
 */
export async function queueAction(type, payload = {}) {
  const queue = await readQueue();
  queue.push({ type, timestamp: new Date().toISOString(), payload });
  await writeQueue(queue);
}

/**
 * Attempts to flush the local queue to the Backend. Silently no-ops if
 * empty or if the network call itself fails (queue is left intact for the
 * next attempt) — never throws, so callers can fire-and-forget this from
 * a focus effect.
 */
export async function flushQueue() {
  const queue = await readQueue();
  if (queue.length === 0) return;

  try {
    const { data } = await syncApi.syncOfflineActions(queue.slice(0, 100));
    const processedCount = data?.results?.length ?? queue.length;
    const remaining = queue.slice(processedCount);
    await writeQueue(remaining);
  } catch {
    // Still offline or the request failed outright — leave the queue as-is.
  }
}
