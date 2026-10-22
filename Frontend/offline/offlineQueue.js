import AsyncStorage from '@react-native-async-storage/async-storage';
import * as syncApi from '../apiClient/services/sync.api';

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
  }
}

export async function queueAction(type, payload = {}) {
  const queue = await readQueue();
  queue.push({ type, timestamp: new Date().toISOString(), payload });
  await writeQueue(queue);
}

export async function flushQueue() {
  const queue = await readQueue();
  if (queue.length === 0) return;

  try {
    const { data } = await syncApi.syncOfflineActions(queue.slice(0, 100));
    const processedCount = data?.results?.length ?? queue.length;
    const remaining = queue.slice(processedCount);
    await writeQueue(remaining);
  } catch {
  }
}
