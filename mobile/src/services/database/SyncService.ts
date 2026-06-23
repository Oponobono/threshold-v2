import { syncQueueRepository } from './repositories/SyncQueueRepository';
import { databaseService } from './DatabaseService';
import { mediaSyncService } from './MediaSyncService';
import { useLocalAIStore } from '../../store/useLocalAIStore';
import { useConnectivityStore } from '../../store/useConnectivityStore';

type SyncHandler = (operation: {
  entity_type: string;
  entity_id: string | undefined;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
}) => Promise<void>;

type ConflictStrategy = 'last-write-wins' | 'client-wins' | 'server-wins';

export class SyncService {
  private isSyncing = false;
  private syncHandler: SyncHandler | null = null;
  private conflictStrategy: ConflictStrategy = 'last-write-wins';
  private syncRetries = 0;
  private maxRetries = 3;

  onSync(handler: SyncHandler): void {
    this.syncHandler = handler;
  }

  async enqueueCreate(entityType: string, entityId: string | undefined, payload: any): Promise<void> {
    await syncQueueRepository.enqueue({
      entity_type: entityType,
      entity_id: entityId,
      operation: 'CREATE',
      payload: payload ? JSON.stringify(payload) : undefined,
    });
    this.triggerSync();
  }

  async enqueueUpdate(entityType: string, entityId: string, payload: any): Promise<void> {
    await syncQueueRepository.enqueue({
      entity_type: entityType,
      entity_id: entityId,
      operation: 'UPDATE',
      payload: payload ? JSON.stringify(payload) : undefined,
    });
    this.triggerSync();
  }

  async enqueueDelete(entityType: string, entityId: string): Promise<void> {
    const pendingOps = await syncQueueRepository.getPendingOperations(entityType, entityId);
    const isCreatePending = pendingOps.some(op => op.operation === 'CREATE');

    if (pendingOps.length > 0) {
      await syncQueueRepository.cancelPendingOperations(entityType, entityId);
    }

    if (!isCreatePending) {
      await syncQueueRepository.enqueue({
        entity_type: entityType,
        entity_id: entityId,
        operation: 'DELETE',
      });
    }
    this.triggerSync();
  }

  async getPendingCount(): Promise<number> {
    return syncQueueRepository.countPending();
  }

  private triggerSync() {
    // Optional automatic trigger, can be debounced
    this.sync().catch(console.error);
  }

  async sync(): Promise<{ success: number; failed: number; pending: number }> {
    if (this.isSyncing) {
      console.log('[SyncService] Sync ya en progreso, ignorando');
      return { success: 0, failed: 0, pending: 0 };
    }

    const forceOffline = useLocalAIStore.getState().forceOfflineMode;
    const isGloballyOffline = !useConnectivityStore.getState().isOnline;
    if (forceOffline || isGloballyOffline) {
      console.log('[SyncService] Modo offline (forzado o sin red) — saltando sync');
      return { success: 0, failed: 0, pending: 0 };
    }
    
    this.isSyncing = true;
    let success = 0;
    let failed = 0;

    try {
      // 🛠️ FASE 1: Binarios (Media Upload)
      const failedMediaIds = await mediaSyncService.syncPendingMedia();

      // 🛠️ FASE 2: JSON Payload Sync
      const items = await syncQueueRepository.getPending();
      
      if (items.length === 0) {
        console.log('[SyncService] No hay operaciones JSON pendientes');
        return { success: 0, failed: 0, pending: 0 };
      }

      // Orden Atómico: Garantizar que 'course' se procese ANTES que 'subject' para evitar FK Constraint
      items.sort((a, b) => {
        const order = { course: 1, subject: 2 };
        const rankA = (order as any)[a.entity_type] || 99;
        const rankB = (order as any)[b.entity_type] || 99;
        if (rankA !== rankB) return rankA - rankB;
        // Si tienen el mismo rango, FIFO (menor ID primero)
        return a.id! - b.id!;
      });

      console.log(`[SyncService] Iniciando Fase 2: sync de ${items.length} operaciones JSON (Orden Atómico aplicado)`);

      for (const item of items) {
        // Fallo silencioso: si el ID está en la lista de media fallida, saltar
        if (item.entity_id && failedMediaIds.has(item.entity_id)) {
          console.log(`[SyncService] Saltando Fase 2 para ${item.entity_type}/${item.entity_id} debido a fallo en Fase 1.`);
          continue;
        }

        if (!this.syncHandler) {
          console.warn('[SyncService] No sync handler registrado');
          break;
        }

        try {
          await syncQueueRepository.markProcessing(item.id!);
          
          // Leer el payload (que puede haber sido actualizado en la BD local durante la Fase 1 si era update, 
          // pero el payload de la cola es una copia antigua. Lo ideal sería inyectar el cloud_url si aplica.
          // Para simplificar, asumimos que si es media, el backend acepta el payload con o sin cloud_url, o
          // mejor leer el estado actual de la tabla en base a la cola).
          let payload = item.payload ? JSON.parse(item.payload) : undefined;

          // Si es una entidad media, inyectamos la URL fresca desde SQLite para evitar sobrescribir con NULL
          if (item.entity_id && (item.entity_type === 'photo' || item.entity_type === 'audio_recording' || item.entity_type === 'scanned_document')) {
             const tableName = item.entity_type + 's'; // simplistic mapping
             try {
               const db = databaseService.getDb();
               const freshRecord: any = await db.getFirstAsync(`SELECT cloud_url FROM ${tableName} WHERE id = ?`, [item.entity_id]);
               if (freshRecord?.cloud_url && payload) {
                 payload.cloud_url = freshRecord.cloud_url;
               }
              } catch (_e) { /* ignore */ }
          }
          
          console.log(`[SyncService] Sincronizando ${item.operation} ${item.entity_type}/${item.entity_id}`);

          await this.syncHandler({
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            operation: item.operation,
            payload,
          });

          await syncQueueRepository.markCompleted(item.id!);
          success++;
          
          console.log(`[SyncService] ✅ ${item.entity_type}/${item.entity_id} sincronizado`);
        } catch (error: any) {
          console.error(`[SyncService] ❌ Error sincronizando ${item.entity_type} ${item.entity_id}:`, error.message);
          await syncQueueRepository.markFailed(item.id!, error.message);
          failed++;
        }
      }

      console.log(`[SyncService] Sync completado: ${success} exitosos, ${failed} fallidos`);
    } catch (error) {
      console.error('[SyncService] Fatal error durante sync:', error);
      failed++;
    } finally {
      this.isSyncing = false;
    }

    const pending = await syncQueueRepository.countPending();
    return { success, failed, pending };
  }

  // Conflict Resolution se movió parcialmente a la capa de API (appInit), 
  // pero exponemos la utilidad para uso interno o del handler.
  resolveConflict(local: any, remote: any, strategy: ConflictStrategy = 'last-write-wins'): { resolved: any; conflictDetected: boolean } {
    const localTime = local?.updated_at ? new Date(local.updated_at).getTime() : 0;
    const remoteTime = remote?.updated_at ? new Date(remote.updated_at).getTime() : 0;
    const conflictDetected = localTime > 0 && remoteTime > 0 && localTime !== remoteTime;
    if (!conflictDetected) return { resolved: local, conflictDetected: false };
    
    let resolved = remoteTime > localTime ? remote : local;
    return { resolved, conflictDetected: true };
  }
}

export const syncService = new SyncService();
