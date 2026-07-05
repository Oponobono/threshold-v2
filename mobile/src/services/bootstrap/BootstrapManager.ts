export type BootstrapPhase =
  | 'DATABASE'
  | 'STORAGE'
  | 'NETWORK'
  | 'AUTH'
  | 'SYNC'
  | 'READY';

export type BootstrapStatus = 'pending' | 'running' | 'done' | 'error';

export interface BootstrapState {
  phase: BootstrapPhase;
  status: BootstrapStatus;
  error?: string;
  timestamp: number;
}

type BootstrapListener = (state: BootstrapState) => void;

class BootstrapManager {
  private _currentPhase: BootstrapPhase = 'DATABASE';
  private _status: BootstrapStatus = 'pending';
  private _listeners: Set<BootstrapListener> = new Set();
  private _started = false;

  get currentPhase(): BootstrapPhase {
    return this._currentPhase;
  }

  get status(): BootstrapStatus {
    return this._status;
  }

  get isReady(): boolean {
    return this._currentPhase === 'READY' && this._status === 'done';
  }

  subscribe(listener: BootstrapListener): () => void {
    this._listeners.add(listener);
    listener({ phase: this._currentPhase, status: this._status, timestamp: Date.now() });
    return () => this._listeners.delete(listener);
  }

  private _emit(): void {
    const state: BootstrapState = {
      phase: this._currentPhase,
      status: this._status,
      timestamp: Date.now(),
    };
    this._listeners.forEach(fn => {
      try { fn(state); } catch { /* ignore */ }
    });
  }

  private async _runPhase(phase: BootstrapPhase, fn: () => Promise<void>): Promise<void> {
    this._currentPhase = phase;
    this._status = 'running';
    this._emit();
    try {
      await fn();
      this._status = 'done';
      this._emit();
    } catch (err: any) {
      this._status = 'error';
      this._error = err.message || `Phase ${phase} failed`;
      this._emit();
      throw err;
    }
  }

  private _error?: string;

  async start(): Promise<void> {
    if (this._started) { console.log('[BOOT] start() already called, skipping'); return; }
    this._started = true;
    console.log('[BOOT 06] BootstrapManager.start() begins');

    try {
      await this._runPhase('DATABASE', async () => {
        console.log('[BOOT 07] PHASE DATABASE: importing DatabaseService...');
        const { databaseService } = await import('../database/DatabaseService');
        console.log('[BOOT 07a] DatabaseService imported, calling open()...');
        await databaseService.open();
        console.log('[BOOT 08] Database ready');
      });

      await this._runPhase('STORAGE', async () => {
        console.log('[BOOT 09] PHASE STORAGE: migrating MMKV...');
        const { migrateFlashcardsFromMMKV } = await import('../migration/migrateFlashcardsFromMMKV');
        await migrateFlashcardsFromMMKV();
        console.log('[BOOT 09z] Storage ready');
      });

      await this._runPhase('NETWORK', async () => {
        console.log('[BOOT 10] PHASE NETWORK: initializing...');
        const { networkManager } = await import('../network/NetworkManager');
        const { useConnectivityStore } = await import('../../store/useConnectivityStore');
        networkManager.subscribe((state) => {
          useConnectivityStore.getState().setNetworkState({
            isOnline: state.isOnline,
            status: state.status,
            isSlow: state.isSlow,
            isExpensive: state.isExpensive,
            type: state.type,
          });
        });
        networkManager.start();

        // Fire-and-forget: no bloqueamos el bootstrap esperando el backend
        const { initializeApiClient } = await import('../api/client');
        initializeApiClient().then(() => {
          console.log('[BOOT 10z] Network initialized (async)');
        }).catch((err: any) => {
          console.warn('[BOOT 10z] Network init failed (non-blocking):', err?.message);
        });
        console.log('[BOOT 10a] Network init dispatched (non-blocking)');
      });

      await this._runPhase('AUTH', async () => {
        console.log('[BOOT 11] PHASE AUTH...');

        // Caso 1: Cargar perfil desde SQLite (local, rápido, sin red)
        const { userRepository } = await import('../database/repositories/UserRepository');
        let localProfileExists = false;
        try {
          localProfileExists = !!(await userRepository.getCurrentUser());
          console.log(localProfileExists
            ? '[BOOT 11a] Profile loaded from local DB'
            : '[BOOT 11b] No local profile (first install)');
        } catch {
          // Sin perfil local — esperable en primer inicio
        }

        // Caso 2: Refrescar/cargar perfil remoto en background (fire-and-forget)
        const { getCurrentUserProfile } = await import('../api/auth');
        getCurrentUserProfile().then(async (profile) => {
          if (profile) {
            await userRepository.saveProfile(profile);
            console.log(localProfileExists
              ? '[BOOT 11z] Profile refreshed from remote'
              : '[BOOT 11z] Profile fetched from remote (first time)');
          }
        }).catch((err: any) => {
          // Timeout/network: si teníamos perfil local lo conservamos;
          // si es primer inicio, la app arranca sin perfil y muestra Login
          if (localProfileExists) {
            console.log('[BOOT 11b] Remote fetch failed (keeping local profile):', err?.message);
          }
        });

        console.log('[BOOT 11z] Auth ready');
      });

      await this._runPhase('SYNC', async () => {
        console.log('[BOOT 12] PHASE SYNC: login...');
        const { syncManager } = await import('../sync/SyncManager');
        const { syncService } = await import('../database/SyncService');
        const { databaseService } = await import('../database/DatabaseService');
        const { fetchWithFallback } = await import('../api/client');
        const { getUserId } = await import('../api/auth');

        // Fire-and-forget: login y sync se ejecutan en background
        syncManager.login().then(() => {
          console.log('[BOOT 12a] Sync login completed (async)');
        }).catch((err: any) => {
          console.warn('[BOOT 12a] Sync login failed (non-blocking):', err?.message);
        });

        this._registerSyncHandlers(syncService, databaseService, fetchWithFallback, getUserId);

        syncService.getPendingCount().then(pendingCount => {
          if (pendingCount > 0) {
            console.log(`[BOOT 12d] ${pendingCount} pending operations, syncing...`);
            syncService.sync().catch(err =>
              console.warn('[BOOT 12e] Sync on init failed:', err)
            );
          }
        }).catch(() => {});

        const { MomentumService } = await import('../MomentumService');
        MomentumService.updateAllMomentumScores().catch(err =>
          console.warn('[BOOT 12g] Momentum recalculation error:', err)
        );

        console.log('[BOOT 12z] Sync dispatched (non-blocking)');
      });

      await this._runPhase('READY', async () => {
        console.log('[BOOT 13] PHASE READY: loading DataStore...');
        try {
          const { useDataStore } = await import('../../store/useDataStore');
          await useDataStore.getState().loadAllData();
        } catch (err) {
          console.warn('[BOOT 13a] Pre-load DataStore failed:', err);
        }
        console.log('[BOOT 14] App ready');
      });

      console.log('[BOOT 15] BootstrapManager.start() completed successfully');
    } catch (err: any) {
      console.error(`[BOOT 15!] BootstrapManager failed at phase ${this._currentPhase}:`, err);
      throw err;
    }
  }

  private _registerSyncHandlers(
    syncService: any,
    databaseService: any,
    fetchWithFallback: any,
    getUserId: any,
  ): void {
    syncService.onSync(async ({ entity_type, entity_id, operation, payload }: any) => {
      let path = `/${entity_type}s`;
      if (entity_type === 'course') path = '/courses';
      if (entity_type === 'assessment_category') path = '/assessmentCategories';
      if (entity_type === 'audio_recording') path = '/audio-recordings';
      if (entity_type === 'audio-transcript') path = '/audio-transcripts';
      if (entity_type === 'scanned_document') path = '/scanned_documents';
      if (entity_type === 'flashcard-deck') path = '/flashcard-decks';
      if (entity_type === 'assessment_files') path = `/assessments/${payload?.assessment_id}/files`;
      if (entity_type === 'flashcard') {
        if (operation === 'CREATE') {
          if (payload?.content_json) {
            path = `/flashcard-decks/${payload?.deck_id}/items`;
          } else {
            path = `/flashcard-decks/${payload?.deck_id}/cards`;
          }
        } else {
          path = '/flashcards';
        }
      }
      if (entity_type === 'calendar-event') path = '/calendar/events';
      if (entity_type === 'ai-chat') path = '/ai/chats';
      if (entity_type === 'user-preference') path = '/user-preferences';
      if (entity_type === 'threshold-overrides') path = '/threshold-overrides';
      if (entity_type === 'category') {
        if (operation === 'CREATE') path = `/subjects/${payload?.subject_id}/categories`;
        else path = '/categories';
      }
      if (entity_type === 'study-session') path = '/learning/sessions';

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
        } catch { }
      }

      if (entity_type === 'photo' && payload) {
        const uid = await getUserId();
        if (uid && !payload.userId) payload.userId = uid;
      }

      if (entity_type === 'card-review') path = `/flashcards/${entity_id}/review`;
      if (entity_type === 'card-log') path = '/learning/card_logs';
      if (entity_type === 'card-snooze') path = `/flashcards/${entity_id}/snooze`;

      if (entity_id && operation !== 'CREATE' && entity_type !== 'card-review' && entity_type !== 'card-snooze') path += `/${entity_id}`;

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
            throw new Error(`ORPHAN_DROP: Parent removed locally (${parentTable}/${parentIdField})`);
          }
        }
      }

      if ((entity_type === 'audio-transcript' || entity_type === 'youtube-transcript') && operation === 'CREATE' && payload) {
        try {
          const parentId = entity_type === 'audio-transcript' ? payload.recording_id : payload.video_id;
          if (entity_type === 'audio-transcript') {
            const parentRes = await fetchWithFallback(`/audio-recordings/check/${parentId}`, { method: 'GET' });
            if (!parentRes.ok) {
              throw new Error(`Parent recording ${parentId} not on server yet. Retrying later.`);
            }
          }
        } catch (checkErr: any) {
          if (checkErr.message?.includes('ORPHAN_DROP')) throw checkErr;
          throw new Error(`Parent entity pending sync: ${checkErr.message}`);
        }
      }

      if (payload && payload.version_number !== undefined && payload.sync_version === undefined) {
        payload.sync_version = payload.version_number;
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

      if (operation === 'CREATE' && entity_type === 'flashcard-deck') {
        try {
          const body = await response.json().catch(() => null);
          if (body?.id) {
            const { flashcardDeckRepository } = await import('../database/repositories/FlashcardDeckRepository');
            await flashcardDeckRepository.upsert({
              id: body.id,
              user_id: body.user_id || payload?.user_id || '',
              title: body.title || payload?.title || '',
              description: body.description ?? payload?.description,
              subject_id: body.subject_id ?? payload?.subject_id,
              card_count: body.card_count ?? 0,
              created_at: body.created_at || new Date().toISOString(),
            });
          }
        } catch (saveErr) {
          console.warn('[SyncService] Error saving deck post-sync:', saveErr);
        }
      }
    });

    console.log('[Bootstrap] Sync handlers registered');
  }
}

export const bootstrapManager = new BootstrapManager();
