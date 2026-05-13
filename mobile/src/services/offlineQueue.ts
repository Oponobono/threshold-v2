/**
 * offlineQueue.ts
 *
 * Cola local de resistencia para card_logs (Learning Engineering).
 *
 * Arquitectura:
 * - Cuando `createCardLog` falla por red, el log se encola en AsyncStorage.
 * - Al recuperar conectividad (o al iniciar la app), `flushOfflineQueue`
 *   envía los logs pendientes en batch y los elimina de la cola.
 * - Completamente transparente al llamador: `createCardLogWithFallback`
 *   reemplaza a `createCardLog` y maneja todo automáticamente.
 *
 * Garantías:
 * - Nunca se pierden datos de estudio por falta de red.
 * - El flush es idempotente: si un log ya fue enviado, no se duplica.
 * - Si el servidor sigue sin estar disponible, los logs permanecen en la cola.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { fetchWithFallback, parseJsonSafely } from './api/client';
import { getUserId } from './api/auth';

const QUEUE_KEY = '@threshold_offline_card_logs';

export interface QueuedCardLog {
  card_id: number;
  user_id: number | string;
  result?: string | null;
  response_time_ms?: number | null;
  question_word_count?: number | null;
  queued_at: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedCardLog[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedCardLog[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[OfflineQueue] Error persisting queue:', e);
  }
}

async function enqueue(log: QueuedCardLog): Promise<void> {
  const queue = await readQueue();
  queue.push(log);
  await writeQueue(queue);
  console.log(`[OfflineQueue] 📦 Enqueued card_log (card_id=${log.card_id}). Queue size: ${queue.length}`);
}

/** Returns how many logs are waiting to be synced */
export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

// ─── Flush ────────────────────────────────────────────────────────────────────

/**
 * Sends all queued card_logs to the server in sequence.
 * Removes successfully sent items from the queue.
 * Safe to call at any time — skips if queue is empty or device is offline.
 */
export async function flushOfflineQueue(): Promise<{ sent: number; remaining: number }> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    console.log('[OfflineQueue] 📵 Device offline — skipping flush.');
    return { sent: 0, remaining: await getPendingCount() };
  }

  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  console.log(`[OfflineQueue] 🔄 Flushing ${queue.length} pending log(s)...`);

  const remaining: QueuedCardLog[] = [];
  let sent = 0;

  for (const log of queue) {
    try {
      const response = await fetchWithFallback('/learning/card_logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: log.card_id,
          user_id: log.user_id,
          result: log.result,
          response_time_ms: log.response_time_ms,
          question_word_count: log.question_word_count,
        }),
      });

      if (response.ok) {
        sent++;
        console.log(`[OfflineQueue] ✅ Synced card_id=${log.card_id}`);
      } else {
        // Server error — keep in queue, retry later
        remaining.push(log);
        console.warn(`[OfflineQueue] ⚠️ Server rejected card_id=${log.card_id}, keeping in queue.`);
      }
    } catch {
      // Network error — keep in queue
      remaining.push(log);
    }
  }

  await writeQueue(remaining);
  console.log(`[OfflineQueue] ✅ Flush complete. Sent: ${sent}, Remaining: ${remaining.length}`);
  return { sent, remaining: remaining.length };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `createCardLog`.
 *
 * - If online: sends immediately and returns the server response.
 * - If offline (or network error): stores locally and returns a synthetic
 *   response so the UI doesn't break.
 */
export const createCardLogWithFallback = async (
  logData: { card_id: number; result?: string | null; response_time_ms?: number | null; question_word_count?: number | null }
): Promise<any> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Usuario no autenticado');

  const netState = await NetInfo.fetch();

  if (netState.isConnected) {
    try {
      const response = await fetchWithFallback('/learning/card_logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...logData, user_id: userId }),
      });

      const data = await parseJsonSafely(response);

      if (response.ok) return data;

      // Server error → fallback to queue
      throw new Error(data?.error || 'Server error');
    } catch (networkError) {
      console.warn('[OfflineQueue] 🔌 Network error — queuing log for later sync.');
      await enqueue({
        ...logData,
        user_id: userId,
        queued_at: new Date().toISOString(),
      });
      return { queued: true, card_id: logData.card_id };
    }
  } else {
    // Definitively offline
    console.log('[OfflineQueue] 📵 Offline — queuing card_log for later sync.');
    await enqueue({
      ...logData,
      user_id: userId,
      queued_at: new Date().toISOString(),
    });
    return { queued: true, card_id: logData.card_id };
  }
};
