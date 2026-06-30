# Session Context

## Goal
Eliminar require cycle, hidratar perfil antes del primer render del Dashboard, unificar inicialización del API Client en BootstrapManager y optimizar backend detector con competitive race + cancelación vía AbortController.

## Constraints & Preferences
- No comentar código a menos que sea estrictamente necesario.
- No refactorizar código estable sin ganancia funcional clara.
- SQLite como única fuente de verdad para datos de negocio; MMKV reservado para JWT, tokens, flags, configuración, metadatos.
- La capa UI no debe importar directamente de `services/api`; debe hacerlo vía DataStore, Repositories o Queries.
- Mantener el orden de secciones del template.

## Principio Rector
"Si no puedes observar una sincronización, no puedes confiar en ella."

## Progress
### Done
- **[*NUEVO*] Require Cycle eliminado**: `localFlashcardService.ts` cambió de barrel `./api` a import directo `./api/auth`. Rompe el ciclo `api/index.ts → analytics.ts → localMasteryService.ts → localFlashcardService.ts → api/index.ts`.
- **[*NUEVO*] Profile = null eliminado**: Bootstrap READY phase ejecuta `loadAllData()` del store antes de emitir `READY`. Dashboard inicializa `profile` desde `storeProfile`.
- **[*NUEVO*] `initializeApiClient()` unificado en Bootstrap**: NETWORK phase llama y awaitza `initializeApiClient()`. `_layout.tsx` ya no lo importa ni invoca.
- **[*NUEVO*] Backend Detector awaitzado**: `initializeApiClient()` ya no es fire-and-forget; `detectAvailableBackend()` se awaitza internamente. NETWORK phase bloquea hasta tener backend definitivo.
- **[*NUEVO*] Competitive race + AbortController**: `findAvailableBackendParallel()` resuelve al primer 200. Render gana en ~307ms vs 2338ms. Los 7 checks perdedores se abortan sin logs.
- **[*NUEVO*] Platform URL filtering**: `localhost` eliminado como candidato en Android. Ahora solo `10.0.2.2` (emulador) + LAN IP (físico) + Render. Fallback en `setupDefaultApiUrls` también es platform-aware.
- **[*NUEVO*] Device Tier corrige clasificación**: Usaba RAM disponible (1.4GB → `low`). Ahora usa RAM total (7.3GB → `high`). La disponible fluctúa; la total es estable.
- **Decks offline**: `FlashcardNewDeckScreen.tsx` — subject made optional.
- **Import cards persisted**: `FlashcardImportModal.tsx` — calls `addLocalCard()` per card into MMKV.
- **Local decks visible in list**: `useFlashcardsManager.ts` — merges MMKV + SQLite decks.
- **Cards read from both stores**: `flashcards.ts` — merges SQLite + MMKV cards at read time.
- **PDF import hybrid OCR**: `PDFImportModal.tsx` — switched to `extractTextFromPDFHybrid` (offline-first).
- **Scanner OCR for images**: `DocumentScannerModal.tsx` — OCR runs for both image and PDF export.
- **Calendar modal bottom safe-area**: `EventCreationModal.tsx` — added `paddingBottom: insets.bottom`.
- **Backup progress notifications**: `notificationService.ts` — 8 functions for upload/download progress.
- **Dashboard sheet modals bottom safe-area**: `CreateTaskModal`, `SubjectSelectorModal`, `CategorySelectorModal` — `useSafeAreaInsets` applied.
- **Zyren context selector redesigned**: `SubjectAIContextModal.tsx` — search, pills, pagination.
- **Backup flow resilience**: `backupService.ts` — `POST /backup/mark` failures no longer throw.
- **Migration runner fixed**: incremental migrations, `PRAGMA foreign_keys = ON`.
- **[HUB] Course Hub**: SectionList, CourseAccordion, CourseSubjectCard, aggregatedMomentumScore, momentum decay.
- **[HUB] Deep Linking**: `vnd.youtube:` schema, `Linking.openURL(https)` for all others, WebBrowser fallback.
- **[HUB] Zyren Ingestion**: `generateClassFlashcards` endpoint + 3-step modal.
- **Sync architecture**: SyncManager, EntitySynchronizer abstraction, BootstrapManager, event-bus repositories, SyncJournal (migration v20), ConflictResolver, CachePolicyManager, DataLoader.
- **AI Platform**: AIOrchestrator, 5 Capabilities (Chat/Flashcard/OCR/PDF/Transcription), Policy Engine (6 modes), Semantic Cache, Groq/Gemini moved to backend-only, hybridAIService refactored to 223 lines.
- **Migration v21**: `version_number`, `last_modified_by`, `deleted_at` on 10 syncable tables.
- **Backend sync_version table**: Created + columns on 6 tables — **pero nunca se incrementa** (hallazgo crítico).
- **Sync Audit**: Matriz de cobertura completada, 3 sospechas confirmadas (sync_version no incrementa, entidades faltantes en ciclos, compactación parcial).
- **SyncDebugger**: `SyncDebugger.ts` — traceId por sync, operationId por operación, 15 SyncStage, buffer en memoria (2000) + persistencia batch, stage timing (timeStart/timeEnd), migration v22 (`sync_debug_logs` table). Integrado en SyncManager, SyncService, SyncQueueRepository, backend syncController (X-Trace-Id).
- **SyncQueueReducer**: módulo `mobile/src/services/sync/reducer/` — OperationReducer (máquina de estados por entidad, pure function, reducción por estado final), DependencyResolver (orden topológico con 28+ entity ranks), ValidationRules (pre-flight + entity existence), ReductionReport (stats: merged/removed/noop/restored), index.ts (reduce() puro: agrupa → reduce → ordena → valida → reporta). Integrado en SyncService.ts reemplazando ordenamiento atómico inline + reemplazando markCompleted por markCompletedBatch.
- **Bug `is_backed_up` corregido**: migration 18 hacía `UPDATE flashcards SET is_backed_up = 0` sin haber agregado la columna. Fix: se eliminó esa línea de migration 18 y se agregó migration 23 con `ALTER TABLE flashcards ADD COLUMN is_backed_up INTEGER DEFAULT 0`. `runMigrations()` ahora verifica `PRAGMA table_info` antes de cada `ALTER TABLE ADD COLUMN` para evitar "duplicate column".
- **Sync retry limit**: `SyncService.MAX_RETRIES = 5`. `markFailed()` devuelve `Promise<number>`. `getPending()` incluye `failed` por defecto. Errores 4xx descartan permanentemente. Stale ops (retries ≥ 5) se limpian pre-reduce.
- **Backend SyntaxError fix**: syncController.js línea 130 — eliminado TypeScript `(s: number, arr: any)` que causaba error en Node.js v26.
- **Download flow logging**: `downloadService.ts` ahora tiene logs en cada etapa: entrada, response de cloud-items, conteo por categoría, prefs, skip de mazo con razón, descarga JSON desde Uploadthing, resultado final.
- **`getCloudItemsCount` corregido**: ahora suma `flashcardDecks` y `aiChats` además de las 5 categorías originales.

### In Progress
- 🔴 **Sprint 2 (Assets) — Pipeline completo**: Infraestructura creada (AssetSyncEngine, colas upload/download, PersistentLocalAssetStore, 3 synchronizers, AssetValidator). Integrado en SyncManager. Upload wiring en api/photos/audio/documents. Priority download en ImageViewerModal. Faltan escenarios de test y Consistency Report.

### Next Up
- 🟡 **Sync Test Suite expansion** — escenarios de asset: offline create → sync → verify en segundo dispositivo; interrupted download → resume → checksum OK; corrupt file → detect → redownload.
- 🟡 **Consistency Report** — post-sync: uploaded/downloaded/conflicts/queueRemaining/backendVersion/sqliteVersion/status. Incluir reporte de AssetValidator.
- ✅ **Download flow** — diagnosticado: NO es bug de infraestructura. El flujo funciona correctamente. Los 9 mazos se saltan porque ya existen localmente (mismos IDs negativos). El logging agregado ahora hace visible cada skip.

### Blocked
- *(none)*

## Gold Rule (post-architecture-freeze)
- No new module if an existing one can solve the problem without losing clarity.
- No abstraction "just in case". Every new layer must justify what problem it solves.
- The architecture is stable enough to build on for a long time. Optimize, don't restructure.
- A partir de ahora: toda hora de desarrollo debe aumentar la confianza en el sistema, no su complejidad. Medir, validar, automatizar pruebas, corregir bugs con evidencia.

## Key Decisions
### Arquitectura de Sync Audit
- Sync audit precede a cualquier cambio de código. Arreglar síntomas sin matriz de cobertura completa no es confiable.
- La participación de entidades debe rastrearse por ciclo (CREATE/UPDATE/DELETE/PUSH/PULL/Initial/Conflict) — las aristas faltantes son la fuente del bug.
- Toda escritura en backend debe incrementar `sync_version` — si una tabla modifica datos sin avanzar el contador, los clientes nunca lo traen.
- Los deletes deben usar soft-delete + tabla `sync_deletions`.
- Analytics debe tratarse como dato derivado (recalculado localmente, no sincronizado bidireccionalmente).
- Settings debe estar en initial + delta + push siempre — cambian comportamiento global.
- Assets (photos, audio, documents) deben tener pipeline separado (blob/chunk/resume/checksum).
- SyncQueueReducer es prioridad sobre SyncValidator y Test Suite porque es el único que modifica comportamiento (los otros solo observan).
- Reducer debe ser función pura: recibe lista de operaciones, devuelve lista reducida + ReductionReport. No escribe en SQLite, no hace HTTP, no modifica sync_queue, no registra logs por sí mismo.
- Reducción modela estado final del historial completo (CREATE+UPDATE+UPDATE+DELETE → no-op), no recorre pares secuencialmente.
- Reducer agrupa por (entity_type, entity_id) antes de reducir — cada grupo se procesa independientemente.
- Se introduce operación RESTORE para secuencias DELETE+CREATE (mismo ID), traducida por SyncService a UPDATE semántico.
- La cola original no se modifica; la reducida se genera nueva. Si falla, la original permanece intacta.
- `sync_queue` debe evolucionar a Event Store con traceId, version, dependsOn, retry, createdAt.

### Decisiones previas (congeladas)
- **Dual storage merge**: MMKV canonical for deck+cards; merge with SQLite at read time.
- **Hybrid routing for OCR/PDF extraction**: `extractTextFromImageHybrid` / `extractTextFromPDFHybrid`.
- **Inline safe-area padding for modals**: `useSafeAreaInsets()` with inline `paddingBottom`.
- **Hub: useCallback for SectionList handlers**: preserve `React.memo`.
- **Hub: Deep link strategy**: `vnd.youtube:` + `Linking.openURL(https)` + WebBrowser fallback.
- **AI: Policy Engine → Orchestrator → Capabilities**: frozen, no more AI refactors.

## Next Steps
1. **Consistency Report** — post-sync: uploaded/downloaded/conflicts/queueRemaining/backendVersion/sqliteVersion/status.
2. **Sync Test Suite expansion** — escenarios de asset: offline create → sync → verify; interrupted download → resume; corrupt file → redownload.
3. **Migrar `expo-av` → `expo-audio`/`expo-video` y `expo-background-fetch` → `expo-background-task`** antes de SDK 54.
4. **Crear tabla SQLite para `user_groups`** y migrar OverallGPA a cálculo/caché local desde SQLite.
5. **Refactorizar event handlers** (`deleteSubject`, `createStudySession`, `getPredictedSubject`) para que no importen directamente de `services/api`.

## Hallazgos Críticos del Audit
- **sync_version nunca se incrementa** en backend — ningún controller llama a `UPDATE sync_version SET version = version + 1` ni `SET sync_version = <next>` en las tablas de entidad. `syncController.js` ejecuta `WHERE sync_version > ?` que siempre devuelve vacío. **CORREGIDO** vía helper `syncVersion.js` + 9 controllers.
- **initialSync cubre solo 6 entidades** (user, courses, subjects, assessments, schedules, flashcardDecks). Faltan photos, audio, scanned_documents, analytics, settings, calendar, notifications. **CORREGIDO** — ahora 10 entidades.
- **deltaSync cubre solo 5 tablas** + sync_deletions. Mismas entidades faltantes. **CORREGIDO** — ahora 9 tablas.
- **Backend deletes son duros** (DELETE FROM subjects WHERE id = ?), no generan entradas en sync_deletions. **CORREGIDO** vía `recordDeletion()` en 8 controllers.
- **SyncService.ts ordenamiento incompleto**: ~15 entity types caían en rank 99 (sin orden garantizado) — **resuelto** vía DependencyResolver con 28+ entity ranks.
- **SyncQueue compactación parcial**: UPDATE dedup y CREATE→DELETE cancel existían, pero [UPDATE, UPDATE, DELETE] sin collapse — **resuelto** vía SyncQueueReducer con reducción por estado final.
- **Device Tier RAM disponible vs total**: Usaba RAM disponible (fluctuante) para clasificar. Ahora usa RAM total (estable).
- **Verificación Dashboard**: renderiza 3 veces en dev (StrictMode 2 mounts + refreshProfile). No hay duplicación de requests de red.
- **Flujo Bootstrap**: `Database → Storage → Network (338ms) → Auth → Sync → Momentum → Ready`.

## Relevant Files
### Session Actual (App Initialization)
- `mobile/src/services/localFlashcardService.ts` — Require Cycle corregido (import `./api/auth`)
- `mobile/src/services/api/client.ts` — `initializeApiClient()` awaitza detección; `setupDefaultApiUrls` platform-aware
- `mobile/src/services/api/backendDetector.ts` — Competitive race + AbortController + platform filtering
- `mobile/src/services/bootstrap/BootstrapManager.ts` — NETWORK phase llama `initializeApiClient()`; READY phase ejecuta `loadAllData()`
- `app/_layout.tsx` — Eliminado import y call a `initializeApiClient()`
- `app/(tabs)/index.tsx` — Dashboard inicializa `profile` desde `storeProfile`
- `mobile/src/store/useDataStore.ts` — Store con profile/groups/GPA; hidratado por Bootstrap READY
- `mobile/src/utils/deviceCapabilities.ts` — Tier clasificado por RAM total en vez de disponible
### Core Sync
- `mobile/src/services/sync/SyncManager.ts` — Main orchestrator with traceId, timers, debug logging
- `mobile/src/services/sync/SyncJournal.ts` — Sync bitacora
- `mobile/src/services/sync/SyncDebugger.ts` — traceId/operationId logger with stage timing
- `mobile/src/services/sync/types.ts` — SyncState, SyncPhase, SyncProgress, SyncResult, SyncEvent
- `mobile/src/services/sync/EntitySynchronizer.ts` — Interface for entity synchronizers
- `mobile/src/services/sync/synchronizers/SubjectSynchronizer.ts` — Reference implementation
- `mobile/src/services/sync/ConflictResolver.ts` — 4 strategies

### Validator
- `mobile/src/services/sync/validator/types.ts` — EntityValidationResult, SyncValidationResult, EntityConfig
- `mobile/src/services/sync/validator/SyncValidator.ts` — validateAll(), validateEntityType(), formatValidationResult()

### Test Harness
- `mobile/src/services/sync/test/types.ts` — SyncScenario, ScenarioResult, ScenarioMetrics, FaultRule, FaultType
- `mobile/src/services/sync/test/ScenarioRunner.ts` — Runner: register, runAll, runSingle, clear
- `mobile/src/services/sync/test/FaultInjector.ts` — Interceptor: HTTP 500/429/timeout/404/token-expired, SQLITE_BUSY, PACKET_LOSS. Integrado en fetchWithFallback vía hook.
- `mobile/src/services/sync/test/ScenarioReport.ts` — formatScenarioReport(): reporte tabular con métricas
- `mobile/src/services/sync/test/index.ts` — registerDefaultScenarios(), runAllTests()
- `mobile/src/services/sync/test/scenarios/CRUDScenario.ts` — #1: CREATE+UPDATE+DELETE → Reducer → No-op
- `mobile/src/services/sync/test/scenarios/QueueReductionScenario.ts` — #2: 10 CREATEs + 20 UPDATEs → 10 ops
- `mobile/src/services/sync/test/scenarios/DependencyScenario.ts` — #3: Course→Subject→Assessment orden
- `mobile/src/services/sync/test/scenarios/RestoreScenario.ts` — #4: DELETE+CREATE → RESTORE op
- `mobile/src/services/sync/test/scenarios/DeterminismScenario.ts` — #5: reduce(reduce(q)) === reduce(q)
- `mobile/src/services/sync/test/scenarios/FaultToleranceScenario.ts` — #6: HTTP 500/429/timeout sin pérdida
- `mobile/src/services/sync/test/scenarios/StressScenario.ts` — #7: 10000 ops × 100 entidades → PASS

### Reducer
- `mobile/src/services/sync/reducer/OperationReducer.ts` — State machine per entity (pure function)
- `mobile/src/services/sync/reducer/DependencyResolver.ts` — Topological ordering (28+ entity ranks)
- `mobile/src/services/sync/reducer/ValidationRules.ts` — Pre-flight + entity existence validation
- `mobile/src/services/sync/reducer/ReductionReport.ts` — Stats interface (merged/removed/noop/restored/duration)
- `mobile/src/services/sync/reducer/index.ts` — Pure reduce() function: group → reduce → sort → validate → report

### Queue & Database
- `mobile/src/services/database/SyncService.ts` — Queue processor with reducer integration
- `mobile/src/services/database/repositories/SyncQueueRepository.ts` — Queue CRUD + markCompletedBatch
- `mobile/src/services/database/DatabaseService.ts` — Transaction support
- `mobile/src/services/database/migrations.ts` — v20 (SyncJournal), v21 (version_number/last_modified_by/deleted_at), v22 (sync_debug_logs + trace_id)
- `mobile/src/services/database/BaseRepository.ts` — ConflictResolver on upsert
- `mobile/src/services/database/appInit.ts` — Bootstrap and sync handler

### Asset Pipeline (Sprint 2)
- `mobile/src/services/sync/asset/types.ts` — AssetState (7 estados), AssetMetadata, AssetDownloadJob, AssetUploadJob
- `mobile/src/services/sync/asset/PersistentLocalAssetStore.ts` — File system manager, checksums, LRU eviction (3GB)
- `mobile/src/services/sync/asset/BaseAssetSynchronizer.ts` — Clase base abstracta para sincronizadores de assets
- `mobile/src/services/sync/asset/PhotoSynchronizer.ts` — Synchronizer para photos (entityType='photos')
- `mobile/src/services/sync/asset/AudioSynchronizer.ts` — Synchronizer para audio_recordings
- `mobile/src/services/sync/asset/DocumentSynchronizer.ts` — Synchronizer para scanned_documents
- `mobile/src/services/sync/asset/AssetUploadManager.ts` — Cola de subida (2 concurrentes, retry exponencial, FormData)
- `mobile/src/services/sync/asset/AssetDownloadManager.ts` — Cola de descarga (3 concurrentes, checksums, prioridades, resume)
- `mobile/src/services/sync/asset/AssetSyncEngine.ts` — Orquestador: schedulePendingDownloads, requestPriorityDownload, scheduleUpload, getLocalPath
- `mobile/src/services/sync/asset/AssetValidator.ts` — Validación de integridad: checksum post-descarga, detección de archivos corruptos/faltantes
- `mobile/src/services/database/migrations.ts:v25` — Columnas asset_state, checksum, filename, file_size, etc. en photos/audio/documents
- `mobile/src/services/api/photos.ts` — scheduleUpload() al crear foto + priority download en ImageViewerModal
- `mobile/src/services/api/audio.ts` — scheduleUpload() al crear grabación
- `mobile/src/services/api/documents.ts` — scheduleUpload() al crear documento

### Backend (corregido)
- `backend/helpers/syncVersion.js` — 4 funciones: incrementSyncVersion, incrementSyncCounterOnly, recordDeletion, recordDeletions
- `backend/controllers/syncController.js` — initialSync (10 entities) + deltaSync (9 tables)
- `backend/controllers/subjectsController.js` — incrementSyncVersion + recordDeletion + cascade
- `backend/controllers/coursesController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/assessmentsController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/schedulesController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/flashcardsController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/calendarEventsController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/settingsController.js` — incrementSyncVersion + recordDeletion (grading_periods, lms_accounts, threshold_overrides)
- `backend/controllers/galleryController.js` — incrementSyncVersion + recordDeletion (photos)
- `backend/controllers/audioController.js` — incrementSyncVersion + recordDeletion (audio_recordings)
- `backend/controllers/scannedDocumentsController.js` — incrementSyncVersion + recordDeletion (scanned_documents)

### Data Layer
- `mobile/src/services/database/BaseRepository.ts` — Now uses ConflictResolver on upsert
- `mobile/src/services/database/DatabaseService.ts` — Transaction support
- `mobile/src/services/database/repositories/CourseRepository.ts` — SQLite CRUD
- `mobile/src/services/database/appInit.ts` — Bootstrap and sync handler
- `mobile/src/services/database/migrations.ts` — v20 (SyncJournal), v21 (version_number/last_modified_by/deleted_at)

### Mobile API (enqueue calls)
- `mobile/src/services/api/subjects.ts` — enqueueCreate/Update/Delete for subject
- `mobile/src/services/api/courses.ts` — enqueueCreate/Update/Delete for course
- `mobile/src/services/api/photos.ts` — enqueueCreate/Update/Delete for photo
- `mobile/src/services/api/audio.ts` — enqueueCreate/Update/Delete for audio + transcript
- `mobile/src/services/api/documents.ts` — enqueueCreate/Update/Delete for scanned-document
- `mobile/src/services/api/settings.ts` — enqueueCreate/Update/Delete for grading-period, lms-account, threshold-overrides
- `mobile/src/services/api/calendar.ts` — enqueueCreate/Update/Delete for calendar-event
- `mobile/src/services/api/schedules.ts` — enqueueCreate/Update/Delete for schedule
- `mobile/src/services/api/assessments.ts` — enqueueCreate/Update/Delete for assessment
- `mobile/src/services/api/flashcards.ts` — enqueueCreate/Update/Delete for flashcard-deck, flashcard, card-snooze
- `mobile/src/services/api/analytics.ts` — enqueueCreate for card-review
- `mobile/src/services/api/youtube.ts` — enqueueCreate/Update/Delete for youtube-video, youtube-transcript
