/**
 * offlineSyncService.ts
 *
 * Gestiona la cola de sincronización offline para operaciones que fallan sin internet.
 * Las operaciones se guardan localmente y se sincronizan automáticamente cuando recupera conexión.
 */

import { MMKV, createMMKV } from 'react-native-mmkv';

interface PendingOperation {
  id: string;
  type: 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  payload?: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
  operationType: 'subject' | 'assessment' | 'schedule' | 'photo' | 'flashcard_review' | 'flashcard_status' | 'flashcard_snooze' | 'flashcard_delete';
}

let _storage: MMKV | null = null;

const getStorage = (): MMKV => {
  if (!_storage) {
    _storage = createMMKV();
  }
  return _storage;
};

const SYNC_QUEUE_KEY = 'sync:pending_operations';
const MAX_RETRIES = 3;

let _writeLock: Promise<any> = Promise.resolve();

const withWriteLock = <T>(fn: () => T | Promise<T>): Promise<T> => {
  const prev = _writeLock;
  const next = prev.then(() => fn());
  _writeLock = next.catch(() => {}); // evitar que errores rompan la cadena
  return next;
};

export const offlineSyncService = {
  /**
   * Agrega una operación a la cola de sincronización
   */
  addPendingOperation: async (
    type: 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    operationType: 'subject' | 'assessment' | 'schedule' | 'photo' | 'flashcard_review' | 'flashcard_status' | 'flashcard_snooze' | 'flashcard_delete',
    payload?: any
  ): Promise<string> => {
    return withWriteLock(async () => {
      try {
        const queue = offlineSyncService.getPendingOperations();
        const operationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const operation: PendingOperation = {
          id: operationId,
          type,
          endpoint,
          payload,
          timestamp: Date.now(),
          retries: 0,
          maxRetries: MAX_RETRIES,
          operationType,
        };

        queue.push(operation);
        getStorage().set(SYNC_QUEUE_KEY, JSON.stringify(queue));

        console.log(
          `[OfflineSync] ✅ Operación ${operationType} agregada a cola (${type} ${endpoint})`
        );

        return operationId;
      } catch (error) {
        console.error('[OfflineSync] Error agregando operación:', error);
        throw error;
      }
    });
  },

  /**
   * Obtiene la cola de operaciones pendientes
   */
  getPendingOperations: (): PendingOperation[] => {
    try {
      const item = getStorage().getString(SYNC_QUEUE_KEY);
      if (!item) return [];
      return JSON.parse(item);
    } catch (error) {
      console.warn('[OfflineSync] Error cargando cola:', error);
      return [];
    }
  },

  /**
   * Cuenta operaciones pendientes por tipo
   */
  getPendingCount: (): number => {
    return offlineSyncService.getPendingOperations().length;
  },

  /**
   * Obtiene operaciones pendientes de un tipo específico
   */
  getPendingByType: (operationType: 'subject' | 'assessment' | 'schedule' | 'photo' | 'flashcard_review' | 'flashcard_status' | 'flashcard_snooze' | 'flashcard_delete'): PendingOperation[] => {
    return offlineSyncService
      .getPendingOperations()
      .filter((op) => op.operationType === operationType);
  },

  /**
   * Sincroniza todas las operaciones pendientes
   * Retorna { success: count, failed: count }
   */
  syncPendingOperations: async (fetchFn: (url: string, options: any) => Promise<any>) => {
    return withWriteLock(async () => {
      const queue = offlineSyncService.getPendingOperations();

      if (queue.length === 0) {
        console.log('[OfflineSync] No hay operaciones pendientes');
        return { success: 0, failed: 0, pending: 0 };
      }

      console.log(`[OfflineSync] 🔄 Sincronizando ${queue.length} operaciones pendientes...`);

      let successCount = 0;
      let failedCount = 0;

      const persistQueue = (ops: typeof queue) => {
        getStorage().set(SYNC_QUEUE_KEY, JSON.stringify(ops));
      };

      for (const operation of queue) {
        try {
          const options: any = {
            method: operation.type,
            headers: { 'Content-Type': 'application/json' },
          };

          if (operation.payload) {
            options.body = JSON.stringify(operation.payload);
          }

          const response = await fetchFn(operation.endpoint, options);

          // 404 en DELETE se considera éxito (el recurso ya fue eliminado)
          const okStatus = response.ok || (response.status >= 200 && response.status < 300);
          const delete404 = operation.type === 'DELETE' && response.status === 404;

          if (okStatus || delete404) {
            console.log(
              `[OfflineSync] ✅ ${operation.operationType} sincronizado (${operation.type} ${operation.endpoint})`
            );
            successCount++;
            queue.splice(queue.indexOf(operation), 1);
            persistQueue(queue);
          } else {
            if (operation.retries < operation.maxRetries) {
              operation.retries++;
              console.warn(
                `[OfflineSync] ⚠️ ${operation.operationType} falló (intento ${operation.retries}/${operation.maxRetries})`
              );
            } else {
              console.error(
                `[OfflineSync] ❌ ${operation.operationType} falló permanentemente (${operation.type} ${operation.endpoint})`
              );
              failedCount++;
              queue.splice(queue.indexOf(operation), 1);
              persistQueue(queue);
            }
          }
        } catch (error) {
          console.warn(`[OfflineSync] Error sincronizando ${operation.operationType}:`, error);
          if (operation.retries < operation.maxRetries) {
            operation.retries++;
          } else {
            failedCount++;
            queue.splice(queue.indexOf(operation), 1);
            persistQueue(queue);
          }
        }
      }

      console.log(
        `[OfflineSync] ✅ Sincronización completada: ${successCount} éxito, ${failedCount} fallos`
      );

      return { success: successCount, failed: failedCount, pending: queue.length };
    });
  },

  /**
   * Limpia una operación específica de la cola
   */
  removePendingOperation: (operationId: string): Promise<void> => {
    return withWriteLock(async () => {
      try {
        const queue = offlineSyncService.getPendingOperations();
        const updated = queue.filter((op) => op.id !== operationId);
        getStorage().set(SYNC_QUEUE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('[OfflineSync] Error removiendo operación:', error);
      }
    });
  },

  /**
   * Limpia toda la cola de sincronización
   */
  clearQueue: (): void => {
    try {
      getStorage().remove(SYNC_QUEUE_KEY);
      console.log('[OfflineSync] 🗑️ Cola de sincronización limpiada');
    } catch (error) {
      console.error('[OfflineSync] Error limpiando cola:', error);
    }
  },

  /**
   * Obtiene el total de operaciones de flashcards pendientes
   */
  getPendingFlashcardCount: (): number => {
    return offlineSyncService
      .getPendingOperations()
      .filter((op) =>
        ['flashcard_review', 'flashcard_status', 'flashcard_snooze', 'flashcard_delete'].includes(op.operationType)
      ).length;
  },
};

export type { PendingOperation };
