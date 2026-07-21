import { syncQueueRepository } from './repositories/SyncQueueRepository';
import { databaseService } from './DatabaseService';
import { mediaSyncService } from './MediaSyncService';
import { useLocalAIStore } from '../../store/useLocalAIStore';
import { useConnectivityStore } from '../../store/useConnectivityStore';
import { syncDebugger } from '../sync/SyncDebugger';
import { reduce } from '../sync/reducer/index';
import { operationProgressBus } from '../lro/OperationProgressEmitter';
import { OperationType, OperationStage, createLRO } from '../lro/OperationProgress';

type SyncHandler = (operation: {
  entity_type: string;
  entity_id: string | undefined;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: any;
}) => Promise<void>;

type ConflictStrategy = 'last-write-wins' | 'client-wins' | 'server-wins';

const MAX_RETRIES = 5;

export class SyncService {
  private isSyncing = false;
  private syncHandler: SyncHandler | null = null;
  private conflictStrategy: ConflictStrategy = 'last-write-wins';

  onSync(handler: SyncHandler): void {
    this.syncHandler = handler;
  }

  async enqueueCreate(entityType: string, entityId: string | undefined, payload: any, traceId?: string): Promise<void> {
    await syncQueueRepository.enqueue({
      entity_type: entityType,
      entity_id: entityId,
      operation: 'CREATE',
      payload: payload ? JSON.stringify(payload) : undefined,
      trace_id: traceId,
    });
    if (traceId) syncDebugger.log(traceId, null, null, 'QUEUE_ENQUEUE', `CREATE ${entityType}/${entityId}`, undefined, entityType, entityId);
    this.triggerSync();
  }

  async enqueueUpdate(entityType: string, entityId: string, payload: any, traceId?: string): Promise<void> {
    await syncQueueRepository.enqueue({
      entity_type: entityType,
      entity_id: entityId,
      operation: 'UPDATE',
      payload: payload ? JSON.stringify(payload) : undefined,
      trace_id: traceId,
    });
    if (traceId) syncDebugger.log(traceId, null, null, 'QUEUE_ENQUEUE', `UPDATE ${entityType}/${entityId}`, undefined, entityType, entityId);
    this.triggerSync();
  }

  async enqueueDelete(entityType: string, entityId: string, traceId?: string): Promise<void> {
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
        trace_id: traceId,
      });
    }
    if (traceId) syncDebugger.log(traceId, null, null, 'QUEUE_ENQUEUE', `DELETE ${entityType}/${entityId}${isCreatePending ? ' (cancelled - no-op)' : ''}`, { isCreatePending }, entityType, entityId);
    this.triggerSync();
  }

  async getPendingCount(): Promise<number> {
    return syncQueueRepository.countPending();
  }

  async enqueueLegacyUnsyncedData(): Promise<number> {
    const db = databaseService.getDb();
    const tables = [
      { name: 'subjects', type: 'subject' },
      { name: 'courses', type: 'course' },
      { name: 'assessments', type: 'assessment' },
      { name: 'assessment_categories', type: 'category' },
      { name: 'schedules', type: 'schedule' },
      { name: 'calendar_events', type: 'calendar-event' },
      { name: 'flashcard_decks', type: 'flashcard-deck' },
      { name: 'flashcards', type: 'flashcard' },
      { name: 'grading_periods', type: 'grading-period' },
      { name: 'lms_accounts', type: 'lms-account' },
      { name: 'subject_threshold_overrides', type: 'threshold-overrides' },
      { name: 'study_sessions', type: 'study-session' },
      // card_logs excluido intencionalmente: auditoría histórica (NO sincronizable)
      { name: 'youtube_videos', type: 'youtube-video' },
      { name: 'ai_chats', type: 'ai-chat' },
      { name: 'assessment_files', type: 'assessment-file' },
      { name: 'study_notes', type: 'study-note' }
    ];

    let count = 0;
    const fetchPromises = tables.map(async (table) => {
      try {
        const rows: any[] = await db.getAllAsync(
          `SELECT * FROM ${table.name} WHERE version_number = 0 OR version_number IS NULL`
        );
        const chunk = [];
        let localCount = 0;
        for (const row of rows) {
          if (row.deleted_at) continue;
          let payload = { ...row };
          if (table.name === 'study_sessions') {
            payload = {
              id: row.id,
              user_id: row.user_id,
              subject_id: row.subject_id,
              session_type: row.session_type || 'Threshold',
              duration_seconds: row.duration_seconds ?? (row.duration_minutes ? row.duration_minutes * 60 : 0),
              config_value: row.config_value ?? null,
              performance_rating: row.performance_rating ?? (typeof row.rating === 'number' ? row.rating : null),
            };
          }
          chunk.push(syncQueueRepository.enqueue({
            entity_type: table.type,
            entity_id: row.id,
            operation: 'CREATE',
            payload: JSON.stringify(payload),
          }));
          localCount++;
          
          if (chunk.length >= 20) {
            await Promise.all(chunk);
            chunk.length = 0;
          }
        }
        if (chunk.length > 0) {
          await Promise.all(chunk);
        }
        return localCount;
      } catch (e) {
        console.warn(`[SyncService] Error enqueuing legacy data for ${table.name}:`, e);
        return 0;
      }
    });
    
    const results = await Promise.all(fetchPromises);
    count = results.reduce((acc, curr) => acc + curr, 0);
    return count;
  }

  private triggerSync() {
    // Intencional: no lanzar sync() aquí.
    // SyncManager es el único responsable de ejecutar HTTP sync (polling + NetworkManager wake).
    // Esta función existe solo como punto de extensión futuro.
  }

  async sync(traceId?: string, options?: { force?: boolean }): Promise<{ success: number; failed: number; pending: number }> {
    if (this.isSyncing) {
      console.log('[SyncService] Sync ya en progreso, ignorando');
      return { success: 0, failed: 0, pending: 0 };
    }

    const forceOffline = useLocalAIStore.getState().forceOfflineMode;
    const isGloballyOffline = !useConnectivityStore.getState().isOnline;
    if (!options?.force && (forceOffline || isGloballyOffline)) {
      console.log('[SyncService] Modo offline (forzado o sin red) — saltando sync');
      return { success: 0, failed: 0, pending: 0 };
    }
    // Si es forzado, resetear flag offline para que fetchWithFallback no bloquee
    if (options?.force && forceOffline) {
      useLocalAIStore.getState().setForceOfflineMode(false);
    }
    if (options?.force && isGloballyOffline) {
      console.warn('[SyncService] Sync forzado pero sin conectividad de red — puede fallar.');
    }
    
    this.isSyncing = true;
    let success = 0;
    let failed = 0;

    // ── LRO Initialization ──
    const lroOperation = createLRO(OperationType.Sync);
    operationProgressBus.emit('started', { operation: lroOperation });

    const emitSyncProgress = (stage: OperationStage, done: number, total: number, msg?: string) => {
      const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
      lroOperation.stage = stage;
      lroOperation.progress = { current: done, total, percentage, indeterminate: total === 0 };
      if (msg) lroOperation.message = msg;
      operationProgressBus.emit('progress', { operation: lroOperation });
    };

    emitSyncProgress(OperationStage.Preparing, 0, 0, 'Iniciando sincronización...');

    const tid = traceId || 'sync_unknown';
    syncDebugger.log(tid, null, null, 'QUEUE_READ', 'SyncService.sync() started', { itemsCount: 0 });

    try {
      // 🛠️ FASE 1: Binarios (Media Upload)
      syncDebugger.timeStart(tid, 'media_sync');
      const failedMediaIds = await mediaSyncService.syncPendingMedia();
      syncDebugger.timeEnd(tid, 'media_sync', 'QUEUE_PROCESS', `Media sync completed: ${failedMediaIds.size} failed`, { failedCount: failedMediaIds.size });

      // 🛠️ FASE 2: JSON Payload Sync
      syncDebugger.timeStart(tid, 'queue_read');
      let items = await syncQueueRepository.getPending(true);
      syncDebugger.timeEnd(tid, 'queue_read', 'QUEUE_READ', `Read ${items.length} pending operations`, { count: items.length });

      // Descartar operaciones que excedieron el límite de reintentos
      const staleItems = items.filter(i => i.retries >= MAX_RETRIES);
      if (staleItems.length > 0) {
        console.log(`[SyncService] Descartando ${staleItems.length} operaciones con ${MAX_RETRIES}+ reintentos`);
        syncDebugger.log(tid, null, null, 'QUEUE_PROCESS', `Discarding ${staleItems.length} stale operations (≥${MAX_RETRIES} retries)`, { count: staleItems.length });
        await syncQueueRepository.markCompletedBatch(staleItems.map(i => i.id!));
      }
      items = items.filter(i => i.retries < MAX_RETRIES);

      if (items.length === 0) {
        console.log('[SyncService] No hay operaciones JSON pendientes');
        syncDebugger.log(tid, null, null, 'QUEUE_PROCESS', 'No pending JSON operations, skipped');
        return { success: 0, failed: 0, pending: 0 };
      }

      // Reducción de cola: compactar operaciones en estado final por entidad
      syncDebugger.timeStart(tid, 'queue_reduce');
      const { operations: reduced, report, errors } = reduce(items);
      syncDebugger.timeEnd(tid, 'queue_reduce', 'QUEUE_READ', `Reduced ${items.length} → ${reduced.length} ops`, report);

      if (errors.length > 0) {
        syncDebugger.log(tid, null, null, 'QUEUE_PROCESS', `Reduction validation errors: ${errors.length}`, { errors });
      }

      const operations = reduced.length > 0 ? reduced : items.map(i => ({
        operation: i.operation,
        entity_type: i.entity_type,
        entity_id: i.entity_id!,
        payload: i.payload ? JSON.parse(i.payload) : undefined,
        originalIds: [i.id!],
      }));

      console.log(`[SyncService] Iniciando Fase 2: sync de ${operations.length} operaciones (${items.length} → ${reduced.length} reducidas)`);

      let doneCount = 0;
      const totalCount = operations.length;

      emitSyncProgress(OperationStage.Processing, 0, totalCount);

      for (const op of operations) {
        emitSyncProgress(OperationStage.Processing, doneCount, totalCount, `Sincronizando base de datos...`);

        const operationId = syncDebugger.nextOperationId(tid);
        const entityTag = `${op.operation} ${op.entity_type}/${op.entity_id}`;

        // Fallo silencioso: si el ID está en la lista de media fallida, saltar
        if (op.entity_id && failedMediaIds.has(op.entity_id)) {
          console.log(`[SyncService] Saltando Fase 2 para ${entityTag} debido a fallo en Fase 1.`);
          syncDebugger.log(tid, operationId, null, 'QUEUE_PROCESS', `Skipped ${entityTag} — media failed`, undefined, op.entity_type, op.entity_id);
          continue;
        }

        if (!this.syncHandler) {
          console.warn('[SyncService] No sync handler registrado');
          syncDebugger.log(tid, null, null, 'ERROR', 'No sync handler registered');
          break;
        }

        try {
          syncDebugger.log(tid, operationId, null, 'QUEUE_PROCESS', `Processing ${entityTag}`, undefined, op.entity_type, op.entity_id);
          syncDebugger.timeStart(tid, `op_handler_${operationId}`);
          
          let payload = op.payload;

          // Si es una entidad media, inyectamos la URL fresca desde SQLite para evitar sobrescribir con NULL
          if (op.entity_id && (op.entity_type === 'photo' || op.entity_type === 'audio-recording' || op.entity_type === 'scanned-document')) {
             const tableName = op.entity_type === 'photo' ? 'photos' : op.entity_type === 'audio-recording' ? 'audio_recordings' : 'scanned_documents';
             try {
               const db = databaseService.getDb();
               const freshRecord: any = await db.getFirstAsync(`SELECT cloud_url FROM ${tableName} WHERE id = ?`, [op.entity_id]);
               if (freshRecord?.cloud_url && payload) {
                 payload = { ...payload, cloud_url: freshRecord.cloud_url };
               }
              } catch (_e) { /* ignore */ }
          }
          
          console.log(`[SyncService] Sincronizando ${entityTag}`);

          // RESTORE → CREATE (el backend maneja upsert/existence check)
          const handlerOp = op.operation === 'RESTORE' ? 'CREATE' : op.operation;
          await this.syncHandler({
            entity_type: op.entity_type,
            entity_id: op.entity_id,
            operation: handlerOp,
            payload,
          });

          syncDebugger.timeEnd(tid, `op_handler_${operationId}`, 'QUEUE_PROCESS', `Completed ${entityTag}`, undefined, operationId, op.entity_type, op.entity_id);
          await syncQueueRepository.markCompletedBatch(op.originalIds);
          success++;
          
          console.log(`[SyncService] ✅ ${entityTag} sincronizado`);
        } catch (error: any) {
          if (error.message?.includes('ORPHAN_DROP')) {
            console.log(`[SyncService] ℹ️ Abortando sync huérfano (padre eliminado): ${entityTag}`);
            syncDebugger.log(tid, operationId, null, 'QUEUE_PROCESS', `Orphan dropped: ${entityTag}`, { reason: 'parent_deleted' }, op.entity_type, op.entity_id);
            await syncQueueRepository.markCompletedBatch(op.originalIds);
            success++;
          } else {
            console.error(`[SyncService] ❌ Error sincronizando ${entityTag}:`, error.message);
            syncDebugger.logError(tid, operationId, 'QUEUE_PROCESS', `Failed ${entityTag}`, error, op.entity_type, op.entity_id);
            for (const id of op.originalIds) {
              const retryCount = await syncQueueRepository.markFailed(id, error.message);
              // Errores 4xx son permanentes (no van a resolverse con reintentos)
              if (retryCount >= MAX_RETRIES || error.message?.includes('Faltan campos') || error.message?.includes('HTTP 400') || error.message?.includes('HTTP 404')) {
                console.log(`[SyncService] Descartando operación ${entityTag} permanentemente (${retryCount} retries, error: ${error.message})`);
                await syncQueueRepository.markCompleted(id);
              }
            }
            failed++;
          }
        }
        doneCount++;
        emitSyncProgress(OperationStage.Processing, doneCount, totalCount, `Sincronizando base de datos...`);
      }

      console.log(`[SyncService] Sync completado: ${success} exitosos, ${failed} fallidos`);
      syncDebugger.log(tid, null, null, 'QUEUE_PROCESS', `Sync completed: ${success} success, ${failed} failed, ${items.length - success - failed} skipped`, { success, failed, total: items.length });
    } catch (error) {
      console.error('[SyncService] Fatal error durante sync:', error);
      syncDebugger.logError(tid, null, 'QUEUE_PROCESS', 'Fatal error', error);
      failed++;
      operationProgressBus.emit('failed', { operation: lroOperation, error: error as Error });
    } finally {
      this.isSyncing = false;
    }

    const pending = await syncQueueRepository.countPending();

    if (failed === 0) {
      operationProgressBus.emit('completed', { operation: lroOperation, result: { success, pending } });
    } else if (success > 0) {
      // Partial success: still mark as completed (we synced something)
      operationProgressBus.emit('completed', { operation: lroOperation, result: { success, failed, pending } });
    }

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
