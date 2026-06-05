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

      if (entity_type === 'photo' && payload) {
        const uid = await getUserId();
        if (uid && !payload.userId) payload.userId = uid;
      }

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
        } catch (e) {
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
    await syncService.sync();
  } catch (error) {
    console.warn('[DB] Initialization failed:', error);
  }
}
