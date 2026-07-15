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

import { databaseService } from '../database/DatabaseService';
import { migrateFlashcardsFromMMKV } from '../migration/migrateFlashcardsFromMMKV';
import { networkManager } from '../network/NetworkManager';
import { useConnectivityStore } from '../../store/useConnectivityStore';
import { initializeApiClient, fetchWithFallback } from '../api/client';
import { userRepository } from '../database/repositories/UserRepository';
import { getCurrentUserProfile, getUserId } from '../api/auth';
import { KnowledgeProjection } from '../../domain/knowledge/KnowledgeProjection';
import { SnapshotBuildReason } from '../../domain/knowledge/SnapshotTelemetryTypes';
import { syncManager } from '../sync/SyncManager';
// Note: syncService is dynamically imported in _registerSyncHandlers to avoid
// circular dependency: BootstrapManager → useDataStore → barrel → CourseRepository → SyncService
import { MomentumService } from '../MomentumService';
import { useDataStore } from '../../store/useDataStore';
import { flashcardDeckRepository } from '../database/repositories/FlashcardDeckRepository';

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
    if (this._status === 'running') { console.log('[BOOT] start() already running, skipping'); return; }
    this._status = 'running';
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
          console.log('[BOOT 10z] Network initialized (async)');
        }).catch((err: any) => {
          console.warn('[BOOT 10z] Network init failed (non-blocking):', err?.message);
        });
        console.log('[BOOT 10a] Network init dispatched (non-blocking)');
      });

      await this._runPhase('AUTH', async () => {
        console.log('[BOOT 11] PHASE AUTH...');

        // Caso 1: Cargar perfil desde SQLite (local, rápido, sin red)
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

        // Dynamic import to break circular dependency:
        // BootstrapManager → useDataStore → barrel → CourseRepository → SyncService
        const { syncService } = await import('../database/SyncService');
        this._registerSyncHandlers(syncService);

        // Fire-and-forget: login y sync se ejecutan en background
        // SyncManager es el único punto de entrada para sync
        syncManager.login().then(() => {
          console.log('[BOOT 12a] Sync login completed (async)');
          syncService.getPendingCount().then(pendingCount => {
            if (pendingCount > 0) {
              console.log(`[BOOT 12d] ${pendingCount} pending operations, syncing...`);
              syncManager.sync().catch(err =>
                console.warn('[BOOT 12e] Sync on init failed:', err)
              );
            }
          }).catch(() => {});
        }).catch((err: any) => {
          console.warn('[BOOT 12a] Sync login failed (non-blocking):', err?.message);
        });

        console.log('[BOOT 12z] Sync dispatched (non-blocking)');
      });

      await this._runPhase('READY', async () => {
        console.log('[BOOT 13] PHASE READY: loading DataStore...');
        try {
          const t0 = performance.now();
          await useDataStore.getState().loadAllData();
          console.log(`[BOOT 13b] loadAllData: ${(performance.now() - t0).toFixed(1)} ms`);
        } catch (err) {
          console.warn('[BOOT 13a] Pre-load DataStore failed:', err);
        }
        console.log('[BOOT 14] App ready');
      });

      // Fire-and-forget: Reminder Coordinator + EventBus + Sync subscription
      (async () => {
        try {
          const { getReminderCoordinator } = await import('../reminders/reminderCoordinatorInstance');
          await getReminderCoordinator().initialize();
          getReminderCoordinator().subscribeToEventBus();

          // Re-sync reminders after each sync cycle
          syncManager.subscribe((event) => {
            if (event.type === 'complete' && event.result?.success) {
              getReminderCoordinator().resync().catch((err: unknown) =>
                console.warn('[BOOT 14r] Reminder resync after sync failed:', err)
              );
            }
          });

          console.log('[BOOT 14r] Reminder Coordinator + EventBus + Sync initialized');
        } catch (err) {
          console.warn('[BOOT 14r] Reminder init failed (non-blocking):', err);
        }
      })();

      // Fire-and-forget: MomentumService no debe competir con queries del bootstrap
      MomentumService.updateAllMomentumScores().catch(err =>
        console.warn('[BOOT 14a] Momentum recalculation error:', err)
      );

      this._started = true;
      this._status = 'done';
      this._emit();
      console.log('[BOOT 15] BootstrapManager.start() completed successfully');

      // Start idle benchmark after system settles (dev only)
      if (__DEV__) {
        setTimeout(() => this._runIdleBenchmark(), 8000);
      }
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
        'card_review':           `/flashcards/${entity_id}/review`,
        'card-review':           `/flashcards/${entity_id}/review`,
        'card_log':              '/learning/card_logs',
        'card-log':              '/learning/card_logs',
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
