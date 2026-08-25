import { RepositoryFactory } from '../database/RepositoryFactory';
export type BootstrapPhase =
  | 'DATABASE'
  | 'STORAGE'
  | 'NETWORK'
  | 'AUTH'
  | 'SYNC'
  | 'AI_CATALOG'
  | 'DATASTORE'
  | 'READY';

export type BootstrapStatus = 'pending' | 'running' | 'done' | 'error';

export interface BootstrapState {
  phase: BootstrapPhase;
  status: BootstrapStatus;
  error?: string;
  timestamp: number;
}

import { databaseService } from '../database/DatabaseService';
import { migrateFlashcardsFromMMKV } from '../migration/migrateFlashcardsFromMMKV';
import { networkManager } from '../network/NetworkManager';
import { useConnectivityStore } from '../../store/useConnectivityStore';
import { initializeApiClient, fetchWithFallback } from '../api/client';
import { getCurrentUserProfile, getUserId } from '../api/auth';
import { sessionIdentity } from '../api/auth/SessionIdentity';
import { KnowledgeProjection } from '../../domain/knowledge/KnowledgeProjection';
import { SnapshotBuildReason } from '../../domain/knowledge/SnapshotTelemetryTypes';
import { syncManager } from '../sync/SyncManager';
// Note: syncService is dynamically imported in _registerSyncHandlers to avoid
// circular dependency: BootstrapManager → useDataStore → barrel → CourseRepository → SyncService
import { MomentumService } from '../MomentumService';
import { useDataStore } from '../../store/useDataStore';
import { waitForAICatalogHydration } from '../../store/useAICatalogsStore';

type BootstrapListener = (state: BootstrapState) => void;

class BootstrapManager {
  private _currentPhase: BootstrapPhase = 'DATABASE';
  private _status: BootstrapStatus = 'pending';
  private _listeners: Set<BootstrapListener> = new Set();
  private _startedForSession: string | null = null;

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
    const currentGeneration = sessionIdentity.currentGeneration;
    if (!currentGeneration) {
      console.log('[BOOT] start() aborted: no active session generation');
      return;
    }
    
    if (this._startedForSession === currentGeneration) { 
      console.log('[BOOT] start() already called for this session, skipping'); 
      return; 
    }
    
    // Clear status if we're starting a new session
    if (this._startedForSession !== currentGeneration && this._startedForSession !== null) {
      this._status = 'pending';
      this._currentPhase = 'DATABASE';
    }

    if (this._status === 'running') { console.log('[BOOT] start() already running, skipping'); return; }
    this._status = 'running';
    this._startedForSession = currentGeneration;
    this._emit();
    console.log('[BOOT 06] BootstrapManager.start() begins');

    try {
      await this._runPhase('DATABASE', async () => {
        console.log('[BOOT 07] PHASE DATABASE: opening...');
        await databaseService.open();
        console.log('[BOOT 08] Database ready');
      });

      await this._runPhase('STORAGE', async () => {
        console.log('[BOOT 09] PHASE STORAGE: migrating MMKV...');
        await migrateFlashcardsFromMMKV();
        console.log('[BOOT 09z] Storage ready');
      });

      await this._runPhase('NETWORK', async () => {
        console.log('[BOOT 10] PHASE NETWORK: initializing...');
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
        initializeApiClient().then(() => {
          console.log('[BACKGROUND] Network initialized (async)');
        }).catch((err: any) => {
          console.warn('[BACKGROUND] Network init failed (non-blocking):', err?.message);
        });
        console.log('[BOOT 10a] Network init dispatched (non-blocking)');
      });

      await this._runPhase('AUTH', async () => {
        console.log('[BOOT 11] PHASE AUTH...');

        // Caso 1: Cargar perfil desde SQLite (local, rápido, sin red)
        let localProfileExists = false;
        try {
          localProfileExists = !!(await RepositoryFactory.users().getCurrentUser());
          console.log(localProfileExists
            ? '[BOOT 11a] Profile loaded from local DB'
            : '[BOOT 11b] No local profile (first install)');
        } catch {
          // Sin perfil local — esperable en primer inicio
        }

        // Caso 2: Refrescar/cargar perfil remoto en background (fire-and-forget)
        // MOVIDO: Para no interferir con el LOCAL_READY, el fetch de red 
        // se ha desplazado a la fase de BACKGROUND posterior al arranque local.

        console.log('[BOOT 11z] Auth ready');
      });

      await this._runPhase('SYNC', async () => {
        console.log('[BOOT 12] PHASE SYNC: login...');

        // Dynamic import to break circular dependency:
        // BootstrapManager → useDataStore → barrel → CourseRepository → SyncService
        const { syncService } = await import('../database/SyncService');
        this._registerSyncHandlers(syncService);

        console.log('[BOOT 12z] Sync handlers registered');
      });

      await this._runPhase('AI_CATALOG', async () => {
        console.log('[BOOT 13] PHASE AI_CATALOG: Waiting for local hydration...');
        const hydrated = await waitForAICatalogHydration();
        if (hydrated) {
          console.log('[BOOT 13a] AI Catalog local hydration completed');
        } else {
          console.log('[BOOT 13b] AI Catalog hydration timeout (Continuing)');
        }
      });

      await this._runPhase('DATASTORE', async () => {
        console.log('[BOOT 14] PHASE DATASTORE: hydrating...');
        try {
          const t0 = performance.now();
          await useDataStore.getState().loadAllData();
          console.log(`[BOOT 14a] DataStore hydration completed: ${(performance.now() - t0).toFixed(1)} ms`);
        } catch (err) {
          console.warn('[BOOT 14b] Pre-load DataStore failed:', err);
        }
      });

      console.log(`[BOOT 14c] 🟢 LOCAL_READY reached at ${Date.now()}`);
      (globalThis as any).__isLocalReady = true;

      await this._runPhase('READY', async () => {
        console.log('[BOOT 15] PHASE READY');
        console.log('[BOOT 15a] App ready');
      });

      // Fire-and-forget: Sync Login & Pending Sync
      // Desplazado POST-LOCAL_READY para evitar peticiones de red (ej. delta sync) antes de la hidratación
      (async () => {
        try {
          await syncManager.login();
          console.log('[BACKGROUND] Sync login completed (async)');
          
          const { syncService } = await import('../database/SyncService');
          const pendingCount = await syncService.getPendingCount();
          if (pendingCount > 0) {
            console.log(`[BACKGROUND] ${pendingCount} pending operations, syncing...`);
            syncManager.sync().catch(err =>
              console.warn('[BACKGROUND] Sync on init failed:', err)
            );
          }
        } catch (err: any) {
          console.warn('[BACKGROUND] Sync login failed (non-blocking):', err?.message);
        }
      })();

      // Fire-and-forget: Reminder Coordinator + EventBus + Sync subscription
      (async () => {
        try {
          const { getReminderCoordinator } = await import('../reminders/reminderCoordinatorInstance');
          const coordinator = await getReminderCoordinator();
          await coordinator.initialize();
          coordinator.subscribeToEventBus();

          // Re-sync reminders after each sync cycle (debounced: rapid syncs → single resync)
          let resyncTimer: ReturnType<typeof setTimeout> | null = null;
          syncManager.subscribe((event) => {
            if (event.type === 'complete' && event.result?.success) {
              if (resyncTimer) clearTimeout(resyncTimer);
              resyncTimer = setTimeout(() => {
                resyncTimer = null;
                coordinator.resync().catch((err: unknown) =>
                  console.warn('[BACKGROUND] Reminder resync after sync failed:', err)
                );
              }, 3000);
            }
          });

          console.log('[BACKGROUND] Reminder Coordinator + EventBus + Sync initialized');
        } catch (err) {
          console.warn('[BACKGROUND] Reminder init failed (non-blocking):', err);
        }
      })();

      // Fire-and-forget: Re-hidrata el DataStore completo tras cada ciclo de sync exitoso.
      // Necesario porque la fase DATASTORE corre antes de que el Initial Sync
      // termine de escribir en SQLite (sync es fire-and-forget). Sin esto,
      // la UI queda con datos obsoletos hasta que el usuario recarga manualmente.
      syncManager.subscribe((event) => {
        if (event.type === 'complete' && event.result?.success) {
          useDataStore.getState().loadAllData(true).catch((err: unknown) =>
            console.warn('[BACKGROUND] Post-sync DataStore refresh failed:', err)
          );
        }
      });

      // Fire-and-forget: MomentumService no debe competir con queries del bootstrap
      MomentumService.updateAllMomentumScores().catch(err =>
        console.warn('[BACKGROUND] Momentum recalculation error:', err)
      );

      // Fire-and-forget: AI catalogs refresh
      (async () => {
        try {
          console.log('[BACKGROUND] Refreshing AI catalogs...');
          const { OnlineModelCatalogService } = await import('../ai/catalogs/OnlineModelCatalogService');
          const { CatalogMergeService } = await import('../ai/catalogs/CatalogMergeService');
          
          await Promise.all([
            OnlineModelCatalogService.fetchOnlineCatalog().catch(() => null),
            CatalogMergeService.refreshLocalCatalog().catch(() => []),
          ]);
          console.log('[BACKGROUND] AI catalogs refresh completed');
        } catch (err) {
          console.warn('[BACKGROUND] AI catalogs refresh failed:', err);
        }
      })();

      // Fire-and-forget: Refrescar perfil remoto
      (async () => {
        try {
          const profile = await getCurrentUserProfile();
          if (profile) {
            await RepositoryFactory.users().saveProfile(profile);
            console.log('[BACKGROUND] Profile refreshed from remote');
          }
        } catch (err: any) {
          console.log('[BACKGROUND] Remote profile fetch failed:', err?.message);
        }
      })();

      this._status = 'done';
      this._emit();
      console.log('[BOOT 15] BootstrapManager.start() completed successfully');

      // Idle benchmark disabled — cumplió su función de medir latencia del bridge.
      // La instrumentación mostró que el primer buildSnapshot(BOOT) tarda ~1.4s
      // por cold start del bridge JSI de expo-sqlite, no por contención.
      // El IdleBenchmark se encolaba DETRÁS del BOOT, no al revés.
    } catch (err: any) {
      this._status = 'error';
      this._error = err.message || 'Bootstrap failed';
      this._emit();
      console.error(`[BOOT 15!] BootstrapManager failed at phase ${this._currentPhase}:`, err);
      throw err;
    }
  }

  private async _runIdleBenchmark(): Promise<void> {
    try {
      const userId = await getUserId();
      if (!userId) {
        console.log('[IdleBenchmark] No user ID, skipping');
        return;
      }

      const projection = new KnowledgeProjection();
      const results: number[] = [];

      for (let i = 1; i <= 3; i++) {
        if (i > 1) await new Promise(r => setTimeout(r, 1000));
        const t0 = performance.now();
        await projection.buildSnapshot(userId, 'MANUAL_REFRESH' as SnapshotBuildReason);
        const ms = performance.now() - t0;
        results.push(ms);
        console.log(`[IdleBenchmark] Snapshot #${i}: ${ms.toFixed(1)} ms`);
      }

      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      const min = Math.min(...results);
      const max = Math.max(...results);
      console.log('[IdleBenchmark] ╔═══════════════════════════════════════╗');
      console.log('[IdleBenchmark] ║  Isolated Snapshot Benchmark         ║');
      console.log('[IdleBenchmark] ╚═══════════════════════════════════════╝');
      console.log(`[IdleBenchmark]   Snapshots: ${results.length}`);
      console.log(`[IdleBenchmark]   #1: ${results[0].toFixed(1)} ms`);
      console.log(`[IdleBenchmark]   #2: ${results[1].toFixed(1)} ms`);
      console.log(`[IdleBenchmark]   #3: ${results[2].toFixed(1)} ms`);
      console.log(`[IdleBenchmark]   ─────────────────────────────`);
      console.log(`[IdleBenchmark]   Average: ${avg.toFixed(1)} ms`);
      console.log(`[IdleBenchmark]   Min:     ${min.toFixed(1)} ms`);
      console.log(`[IdleBenchmark]   Max:     ${max.toFixed(1)} ms`);
      console.log(`[IdleBenchmark]   Range:   ${(max - min).toFixed(1)} ms`);
    } catch (err) {
      console.warn('[IdleBenchmark] Error:', err);
    }
  }

  private _registerSyncHandlers(syncService: any): void {
    syncService.onSync(async ({ entity_type, entity_id, operation, payload }: any) => {
      // ── Route table: entity_type (all variants) → backend base path ──────
      type RouteResolver = string | ((op: string, p: any) => string);
      const ROUTE_TABLE: Record<string, RouteResolver> = {
        // Academic
        'subject':               '/subjects',
        'course':                '/courses',
        'assessment':            '/assessments',
        'assessment_category':   '/assessmentCategories',
        'assessment-category':   '/assessmentCategories',
        'category':              (op, p) => op === 'CREATE' ? `/subjects/${p?.subject_id}/categories` : '/categories',
        'schedule':              '/schedules',
        'grading_period':        '/grading-periods',
        'grading-period':        '/grading-periods',
        'lms_account':           '/lms-accounts',
        'lms-account':           '/lms-accounts',
        'threshold_override':    '/threshold-overrides',
        'threshold-overrides':   '/threshold-overrides',
        // Calendar
        'calendar_event':        '/calendar/events',
        'calendar-event':        '/calendar/events',
        // Flashcards
        'flashcard_deck':        '/flashcard-decks',
        'flashcard-deck':        '/flashcard-decks',
        'flashcard':             (op, p) => {
          if (op !== 'CREATE') return '/flashcards';
          return p?.content_json
            ? `/flashcard-decks/${p?.deck_id}/items`
            : `/flashcard-decks/${p?.deck_id}/cards`;
        },
        // Media / assets
        'photo':                 '/photos',
        'audio_recording':       '/audio-recordings',
        'audio-recording':       '/audio-recordings',
        'audio_transcript':      '/audio-transcripts',
        'audio-transcript':      '/audio-transcripts',
        'youtube_video':         '/youtube-videos',
        'youtube-video':         '/youtube-videos',
        'youtube_transcript':    '/youtube-transcripts',
        'youtube-transcript':    '/youtube-transcripts',
        'scanned_document':      '/scanned_documents',
        'scanned-document':      '/scanned_documents',
        'assessment_file':       (_op, p) => `/assessments/${p?.assessment_id}/files`,
        'assessment_files':      (_op, p) => `/assessments/${p?.assessment_id}/files`,
        'assessment-file':       (_op, p) => `/assessments/${p?.assessment_id}/files`,
        // AI
        'ai_chat':               '/ai/chats',
        'ai-chat':               '/ai/chats',
        // Study
        'study_session':         '/learning/sessions',
        'study-session':         '/learning/sessions',
        'study_notes':           '/study-notes',
        'study-note':            '/study-notes',
        'card_review':           `/flashcards/${entity_id}/review`,
        'card-review':           `/flashcards/${entity_id}/review`,
        // card_logs excluido intencionalmente: auditoría histórica (NO sincronizable)
        'card_snooze':           `/flashcards/${entity_id}/snooze`,
        'card-snooze':           `/flashcards/${entity_id}/snooze`,
        // Settings
        'user_preference':       '/user-preferences',
        'user-preference':       '/user-preferences',
      };

      const routeEntry = ROUTE_TABLE[entity_type];
      if (!routeEntry) {
        throw new Error(`[SyncHandler] No route registered for entity_type="${entity_type}". Add it to ROUTE_TABLE.`);
      }
      const basePath = typeof routeEntry === 'function' ? routeEntry(operation, payload) : routeEntry;

      // Entities whose path already includes the ID — never append /:entity_id
      const NO_ID_SUFFIX = new Set([
        'card-review', 'card_review',
        'card-snooze', 'card_snooze',
      ]);
      let path = basePath;
      if (entity_id && operation !== 'CREATE' && !NO_ID_SUFFIX.has(entity_type)) {
        path += `/${entity_id}`;
      }

      // ── Inject fresh cloud_url for asset entities ────────────────────────
      const ASSET_TABLE_MAP: Record<string, string> = {
        'photo': 'photos',
        'audio_recording': 'audio_recordings',
        'audio-recording': 'audio_recordings',
        'scanned_document': 'scanned_documents',
        'scanned-document': 'scanned_documents',
        'assessment_file': 'assessment_files',
        'assessment_files': 'assessment_files',
        'assessment-file': 'assessment_files',
      };
      const assetTable = entity_id ? ASSET_TABLE_MAP[entity_type] : undefined;
      if (assetTable && payload) {
        try {
          const db = databaseService.getDb();
          const freshRecord: any = await db.getFirstAsync(`SELECT cloud_url FROM ${assetTable} WHERE id = ?`, [entity_id]);
          if (freshRecord?.cloud_url) payload.cloud_url = freshRecord.cloud_url;
        } catch { }
      }

      if (entity_type === 'photo' && payload) {
        const uid = await getUserId();
        if (uid && !payload.userId) payload.userId = uid;
      }

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

      if (operation === 'CREATE' && entity_id && payload && !payload.id) {
        payload.id = entity_id;
      }

      const options: RequestInit = {
        method: operation === 'CREATE' ? 'POST' : operation === 'UPDATE' ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      };
      if (payload && operation !== 'DELETE') {
        options.body = JSON.stringify(payload);
      }

      // Capture generation before await
      const currentGeneration = sessionIdentity.currentGeneration;
      
      const response = await fetchWithFallback(path, options);

      // Validate generation after await
      if (currentGeneration && !sessionIdentity.isValidGeneration(currentGeneration)) {
        throw new Error('SYNC_ABORTED: Session generation changed during push operation');
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error || `HTTP ${response.status}`);
      }

      if (operation === 'CREATE' && entity_type === 'flashcard-deck') {
        try {
          const body = await response.json().catch(() => null);
          if (body?.id) {
              await RepositoryFactory.flashcardDecks().upsert({
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
