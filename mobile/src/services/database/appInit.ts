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
      if (entity_type === 'course') path = '/courses';
      if (entity_type === 'assessment_category') path = '/assessmentCategories';
      if (entity_type === 'audio_recording') path = '/audio-recordings';  // ← Fix: was '/audio'
      if (entity_type === 'audio-transcript') path = '/audio-transcripts'; // ← Explicit mapping
      if (entity_type === 'scanned_document') path = '/scanned_documents';
      // flashcard-deck: default path `${entity_type}s` already produces `/flashcard-decks`
      if (entity_type === 'assessment_files') path = `/assessments/${payload?.assessment_id}/files`;
      if (entity_type === 'ai-chat') path = '/ai/chats';
      if (entity_type === 'user-preference') path = '/user-preferences';
      if (entity_type === 'flashcard') path = `/flashcard-decks/${payload?.deck_id}/cards`;

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

      // ── Generic Orphan Guard: Drop pending child syncs if parent deleted locally ──
      // If a child (transcript, flashcard, etc.) was created offline but its parent was 
      // later deleted offline before sync could occur, we drop the child's pending 
      // operation to prevent infinite FK failures from the server.
      if (operation === 'CREATE' && payload) {
        let parentTable = '';
        let parentIdField = '';

        if (entity_type === 'audio-transcript' && payload.recording_id) {
          parentTable = 'audio_recordings';
          parentIdField = payload.recording_id;
        } else if (entity_type === 'youtube-transcript' && payload.video_id) {
          parentTable = 'youtube_videos';
          parentIdField = payload.video_id;
        } else if (entity_type === 'flashcard' && payload.deck_id) {
          parentTable = 'flashcard_decks';
          parentIdField = payload.deck_id;
        } else if (entity_type === 'assessment_files' && payload.assessment_id) {
          parentTable = 'assessments';
          parentIdField = payload.assessment_id;
        }

        if (parentTable && parentIdField) {
          const db = databaseService.getDb();
          const parentLocal = await db.getFirstAsync(`SELECT id FROM ${parentTable} WHERE id = ?`, [parentIdField]);
          if (!parentLocal) {
            throw new Error(`ORPHAN_DROP: Padre eliminado localmente (${parentTable}/${parentIdField})`);
          }
        }
      }

      // ── Specific Guard: Parent server existence check for transcripts ──
      // Some endpoints (like audio-transcripts) require the parent to ALREADY exist 
      // on the server before accepting the child. If the parent exists locally but not
      // on the server yet, we throw a normal error to DEFER the child until parent syncs.
      if ((entity_type === 'audio-transcript' || entity_type === 'youtube-transcript') && operation === 'CREATE' && payload) {
        try {
          const parentId = entity_type === 'audio-transcript' ? payload.recording_id : payload.video_id;
          const checkPath = entity_type === 'audio-transcript' ? `/audio-recordings/check/${parentId}` : `/youtube-videos/check/${parentId}`;
          
          // Only check audio-recordings as it has a specific /check endpoint implemented.
          // For youtube-videos, we skip the server check unless implemented in the future.
          if (entity_type === 'audio-transcript') {
            const parentRes = await fetchWithFallback(checkPath, { method: 'GET' });
            if (!parentRes.ok) {
              throw new Error(`Grabación padre ${parentId} aún no existe en el servidor. Reintentando más tarde.`);
            }
          }
        } catch (checkErr: any) {
          if (checkErr.message?.includes('ORPHAN_DROP')) throw checkErr;
          throw new Error(`Entidad padre pendiente de sync: ${checkErr.message}`);
        }
      }

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

      // ── Post-sync: guardar response de CREATE flashcard-deck en SQLite ──
      // El mazo se creó en MMKV via saveImportedDeck pero el sync handler
      // nunca persiste la respuesta del servidor en SQLite. Sin esto, UPDATE
      // posteriores fallan con "Mazo no encontrado" (404).
      if (operation === 'CREATE' && entity_type === 'flashcard-deck') {
        try {
          const body = await response.json().catch(() => null);
          if (body?.id) {
            const { flashcardDeckRepository } = await import('./repositories/FlashcardDeckRepository');
            await flashcardDeckRepository.upsert({
              id: body.id,
              user_id: body.user_id || payload?.user_id || '',
              title: body.title || payload?.title || '',
              description: body.description ?? payload?.description,
              subject_id: body.subject_id ?? payload?.subject_id,
              card_count: body.card_count ?? 0,
              created_at: body.created_at || new Date().toISOString(),
            });
            console.log(`[SyncService] Mazo ${body.id} persistido en SQLite tras sync`);
          }
        } catch (saveErr) {
          console.warn('[SyncService] Error guardando mazo en SQLite:', saveErr);
        }
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
    // ── Calcular y actualizar el Momentum Score de todos los cursos en background (On-App-Start) ──
    const { MomentumService } = await import('../MomentumService');
    MomentumService.updateAllMomentumScores().catch(err => 
      console.warn('[DB] Error al recalcular Momentum:', err)
    );

  } catch (error) {
    console.warn('[DB] Initialization failed:', error);
  }
}
