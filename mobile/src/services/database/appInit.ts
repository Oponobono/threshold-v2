import { databaseService } from './DatabaseService';
import { syncService } from './SyncService';
import { fetchWithFallback } from '../api/client';
import { getUserId } from '../api/auth';

export async function initializeDatabase(): Promise<void> {
  try {
    await databaseService.open();
    console.log('[DB] SQLite initialized');

    syncService.onSync(async ({ entity_type, entity_id, operation, payload }) => {
      let path = `/${entity_type}s`;
      if (entity_type === 'assessment_category') path = '/assessmentCategories';
      if (entity_type === 'audio_recording') path = '/audio';
      if (entity_type === 'scanned_document') path = '/scanned_documents';
      if (entity_type === 'flashcard_deck') path = '/flashcard-decks';
      if (entity_type === 'assessment_files') path = `/assessments/${payload?.assessment_id}/files`;

      // Inyectar cloud_url fresca desde SQLite antes de enviar payload a la nube
      if (entity_id && (entity_type === 'photo' || entity_type === 'audio_recording' || entity_type === 'scanned_document' || entity_type === 'assessment_files')) {
        const tableName = entity_type === 'assessment_files'
          ? 'assessment_files'
          : entity_type + 's';
        try {
          const db = databaseService.getDb();
          const freshRecord: any = await db.getFirstAsync(`SELECT cloud_url FROM ${tableName} WHERE id = ?`, [entity_id]);
          if (freshRecord?.cloud_url && payload) {
            payload.cloud_url = freshRecord.cloud_url;
          }
        } catch (_e) { /* ignore */ }
      }

      if (entity_type === 'photo' && payload) {
        const uid = await getUserId();
        if (uid && !payload.userId) payload.userId = uid;
      }

      // Special route overrides that embed entity_id in path
      if (entity_type === 'card-review') path = `/flashcards/${entity_id}/review`;
      if (entity_type === 'card-log') path = '/learning/card_logs';

      // Para CREATE de assessment_files la ruta ya tiene el assessmentId embebido; para UPDATE/DELETE agregar el fileId
      if (entity_id && operation !== 'CREATE') path += `/${entity_id}`;

      // Conflict Resolution: LWW (Last Write Wins) for UPDATE
      if (operation === 'UPDATE' && entity_id && payload) {
        try {
          const currentRes = await fetchWithFallback(path, { method: 'GET' });
          if (currentRes.ok) {
            const currentData = await currentRes.json();
            const localTime = payload?.updated_at ? new Date(payload.updated_at).getTime() : 0;
            const remoteTime = currentData?.updated_at ? new Date(currentData.updated_at).getTime() : 0;
            
            if (remoteTime > localTime) {
              console.warn(`[SyncService] Conflicto: Servidor tiene datos más recientes para ${entity_type}/${entity_id}. Abortando push local.`);
              // Here we could upsert the local db with currentData to heal it immediately.
              return; 
            }
          }
        } catch (_e) {
          console.log(`[SyncService] No se pudo resolver conflicto remoto (offline o error).`);
        }
      }

      const options: RequestInit = {
        method: operation === 'CREATE' ? 'POST' : operation === 'UPDATE' ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      };
      if (payload && operation !== 'DELETE') {
        options.body = JSON.stringify(payload);
      }

      const response = await fetchWithFallback(path, options);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || `HTTP ${response.status}`);
      }
    });

    console.log('[DB] Sync handler registered');

    // Only sync pending operations on startup if there are any queued items.
    // This avoids the cloud call storm on every app restart.
    // Regular sync happens via useAutoSync when connectivity changes.
    const pendingCount = await syncService.getPendingCount();
    if (pendingCount > 0) {
      console.log(`[DB] ${pendingCount} operaciones pendientes, sincronizando...`);
      syncService.sync().catch((err) =>
        console.warn('[DB] Sync on init failed (will retry later):', err)
      );
    }
  } catch (error) {
    console.warn('[DB] Initialization failed:', error);
  }
}
