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
  operationType: 'subject' | 'assessment' | 'schedule' | 'photo'; // Para logging
}

let _storage: MMKV | null = null;

const getStorage = (): MMKV => {
  if (!_storage) {
    _storage = createMMKV();
  }
  return _storage;
};

const SYNC_QUEUE_KEY = 'sync:pending_operations';
const SYNC_CALLBACKS_KEY = 'sync:callbacks';
const MAX_RETRIES = 3;

export const offlineSyncService = {
  /**
   * Agrega una operación a la cola de sincronización
   */
  addPendingOperation: async (
    type: 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    operationType: 'subject' | 'assessment' | 'schedule' | 'photo',
    payload?: any
  ): Promise<string> => {
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
  getPendingByType: (operationType: 'subject' | 'assessment' | 'schedule' | 'photo'): PendingOperation[] => {
    return offlineSyncService
      .getPendingOperations()
      .filter((op) => op.operationType === operationType);
  },

  /**
   * Sincroniza todas las operaciones pendientes
   * Retorna { success: count, failed: count }
   */
  syncPendingOperations: async (fetchFn: (url: string, options: any) => Promise<any>) => {
    const queue = offlineSyncService.getPendingOperations();

    if (queue.length === 0) {
      console.log('[OfflineSync] No hay operaciones pendientes');
      return { success: 0, failed: 0 };
    }

    console.log(`[OfflineSync] 🔄 Sincronizando ${queue.length} operaciones pendientes...`);

    let successCount = 0;
    let failedCount = 0;
    const toRemove: string[] = [];

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

        if (response.ok || (response.status >= 200 && response.status < 300)) {
          console.log(
            `[OfflineSync] ✅ ${operation.operationType} sincronizado (${operation.type} ${operation.endpoint})`
          );
          successCount++;
          toRemove.push(operation.id);
        } else {
          // No es un error de red, pero la operación falló
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
            toRemove.push(operation.id); // Remove after max retries
          }
        }
      } catch (error) {
        console.warn(
          `[OfflineSync] Error sincronizando ${operation.operationType}:`,
          error
        );
        // Network error - keep in queue for next retry
        if (operation.retries < operation.maxRetries) {
          operation.retries++;
        } else {
          failedCount++;
          toRemove.push(operation.id);
        }
      }
    }

    // Remove successful and failed operations
    const updatedQueue = queue.filter((op) => !toRemove.includes(op.id));
    getStorage().set(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));

    console.log(
      `[OfflineSync] ✅ Sincronización completada: ${successCount} éxito, ${failedCount} fallos`
    );

    return { success: successCount, failed: failedCount, pending: updatedQueue.length };
  },

  /**
   * Limpia una operación específica de la cola
   */
  removePendingOperation: (operationId: string): void => {
    try {
      const queue = offlineSyncService.getPendingOperations();
      const updated = queue.filter((op) => op.id !== operationId);
      getStorage().set(SYNC_QUEUE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('[OfflineSync] Error removiendo operación:', error);
    }
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
   * Registra un callback que se ejecuta cuando se completa la sincronización
   */
  onSyncComplete: (callback: (result: { success: number; failed: number; pending: number }) => void) => {
    try {
      // Almacenar callback en un array - simplificado para esta versión
      // En producción, usar EventEmitter
      const callbacks = getStorage().getString(SYNC_CALLBACKS_KEY);
      const callbackList = callbacks ? JSON.parse(callbacks) : [];
      callbackList.push({ timestamp: Date.now(), fn: callback.toString() });
      getStorage().set(SYNC_CALLBACKS_KEY, JSON.stringify(callbackList));
    } catch (error) {
      console.warn('[OfflineSync] Error registrando callback:', error);
    }
  },
};

export type { PendingOperation };
