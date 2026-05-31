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
  operationType: 'flashcard' | 'flashcard_deck' | 'flashcard_review' | 'flashcard_status' | 'flashcard_snooze' | 'flashcard_delete' | 'subject' | 'assessment' | 'schedule' | 'photo' | 'audio' | 'document' | 'grading' | 'calendar' | 'category' | 'group' | 'session' | 'card_log' | 'settings' | 'youtube' | 'profile' | 'biometric';
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

// Mapa de IDs generados offline -> IDs reales del servidor
const idMap: Record<string, string | number> = {};

/**
 * Reemplaza los IDs temporales por los reales en un string
 */
const applyIdMapToString = (str: string): string => {
  let result = str;
  for (const [tempId, realId] of Object.entries(idMap)) {
    // Reemplazar ocurrencias exactas del tempId
    result = result.replace(new RegExp(tempId, 'g'), String(realId));
  }
  return result;
};

/**
 * Reemplaza los IDs temporales en un objeto de forma recursiva
 */
const applyIdMapToPayload = (payload: any): any => {
  if (!payload) return payload;
  if (typeof payload === 'string') {
    return applyIdMapToString(payload);
  }
  if (Array.isArray(payload)) {
    return payload.map(applyIdMapToPayload);
  }
  if (typeof payload === 'object') {
    const newPayload: any = {};
    for (const [key, value] of Object.entries(payload)) {
      newPayload[key] = applyIdMapToPayload(value);
    }
    return newPayload;
  }
  return payload;
};

export const offlineSyncService = {
  /**
   * Agrega una operación a la cola de sincronización
   */
  addPendingOperation: async (
    type: 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    operationType: 'subject' | 'assessment' | 'schedule' | 'photo' | 'audio' | 'flashcard_review' | 'flashcard_status' | 'flashcard_snooze' | 'flashcard_delete' | 'flashcard_deck' | 'flashcard' | 'document' | 'grading' | 'calendar' | 'category' | 'group' | 'session' | 'card_log' | 'settings' | 'youtube' | 'profile' | 'biometric',
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
  getPendingByType: (operationType: 'subject' | 'assessment' | 'schedule' | 'photo' | 'audio' | 'flashcard_review' | 'flashcard_status' | 'flashcard_snooze' | 'flashcard_delete' | 'flashcard_deck' | 'flashcard' | 'document' | 'grading' | 'calendar' | 'category' | 'group' | 'session' | 'card_log' | 'settings' | 'youtube' | 'profile' | 'biometric'): PendingOperation[] => {
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
      let queue = offlineSyncService.getPendingOperations();

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

      // Limpiar idMap al iniciar un nuevo sync batch
      for (const key of Object.keys(idMap)) {
        delete idMap[key];
      }

      // Procesar FIFO atómicamente
      while (queue.length > 0) {
        // Tomamos la primera operación (sin mutar aún)
        const operation = queue[0];
        
        try {
          // 1. Aplicar ID Map a endpoint y payload
          const mappedEndpoint = applyIdMapToString(operation.endpoint);
          const mappedPayload = applyIdMapToPayload(operation.payload);

          const options: any = {
            method: operation.type,
            headers: { 'Content-Type': 'application/json' },
          };

          if (mappedPayload) {
            // Manejar FormData para fotos/audios
            if (operation.operationType === 'photo' || operation.operationType === 'audio') {
               // Construir formData
               const formData = new FormData();
               for (const key in mappedPayload) {
                 if (key === 'file' && typeof mappedPayload.file === 'object' && mappedPayload.file.uri) {
                   formData.append('file', {
                     uri: mappedPayload.file.uri,
                     name: mappedPayload.file.name,
                     type: mappedPayload.file.type || 'image/jpeg',
                   } as any);
                 } else {
                   formData.append(key, mappedPayload[key]);
                 }
               }
               options.body = formData;
               delete options.headers['Content-Type']; // fetch lo asigna automáticamente para FormData
            } else {
               options.body = JSON.stringify(mappedPayload);
            }
          }

          const response = await fetchFn(mappedEndpoint, options);
          const okStatus = response.ok || (response.status >= 200 && response.status < 300);
          const delete404 = operation.type === 'DELETE' && response.status === 404;

          if (okStatus || delete404) {
            console.log(`[OfflineSync] ✅ ${operation.operationType} sincronizado (${operation.type} ${mappedEndpoint})`);
            
            // Si fue un POST exitoso y trajo un ID real, lo mapeamos
            if (operation.type === 'POST') {
              try {
                // Parse response para extraer el ID
                // Aseguramos que la respuesta sea json
                const clone = response.clone();
                const resData = await clone.json();
                if (resData && resData.id && operation.payload && operation.payload.id) {
                  idMap[operation.payload.id] = resData.id;
                  console.log(`[OfflineSync] Mapeado ID temporal ${operation.payload.id} -> ${resData.id}`);
                }
              } catch (e) {
                // Ignorar si no se puede parsear JSON
              }
            }

            successCount++;
            queue.shift(); // Quitar la operación exitosa
            persistQueue(queue); // Persistir inmediatamente
          } else {
            // Evaluamos el error
            if (response.status >= 400 && response.status < 500 && response.status !== 408) {
               // Error 4xx Permanente
               console.error(`[OfflineSync] ❌ ${operation.operationType} falló permanentemente (${response.status}). Abortando.`);
               failedCount++;
               
               // Limpiar dependientes: si esta operación creó un temp_id, borrar de la cola a quienes dependan de él
               const failedTempId = operation.payload?.id;
               
               queue.shift(); // Quitar la operación fallida

               if (failedTempId) {
                  const initialLength = queue.length;
                  queue = queue.filter(op => {
                    const payloadStr = JSON.stringify(op.payload || {});
                    const endpointStr = op.endpoint;
                    return !payloadStr.includes(failedTempId) && !endpointStr.includes(failedTempId);
                  });
                  console.warn(`[OfflineSync] ⚠️ Eliminadas ${initialLength - queue.length} operaciones dependientes del temp_id ${failedTempId}`);
               }
               
               persistQueue(queue); // Persistir inmediatamente
            } else {
               // Error de red temporal (5xx o timeout)
               if (operation.retries < operation.maxRetries) {
                 operation.retries++;
                 console.warn(`[OfflineSync] ⚠️ ${operation.operationType} falló (intento ${operation.retries}/${operation.maxRetries}).`);
                 // Reemplazar la cola persistida con el retries actualizado
                 queue[0] = operation;
                 persistQueue(queue);
                 break; // Detener el loop while, esperar a la próxima sincronización
               } else {
                 console.error(`[OfflineSync] ❌ ${operation.operationType} falló por superar reintentos.`);
                 failedCount++;
                 queue.shift();
                 persistQueue(queue);
               }
            }
          }
        } catch (error) {
          console.warn(`[OfflineSync] Error sincronizando ${operation.operationType}:`, error);
          if (operation.retries < operation.maxRetries) {
            operation.retries++;
            queue[0] = operation;
            persistQueue(queue);
            break; // Detener loop
          } else {
            failedCount++;
            queue.shift();
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
