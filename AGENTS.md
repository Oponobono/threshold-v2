# Session Context

## Goal
Demostrar matemáticamente que el sistema de sincronización nunca pierde datos. Ya no se construye infraestructura — se mide, valida y prueba con evidencia obtenida del SyncDebugger, SyncValidator y Sync Test Suite.

## Constraints & Preferences
- Spanish-language app (i18next).
- Offline-first: UI solo lee de SQLite, nunca de API directa.
- SyncManager es la única autoridad para comunicación de red; ninguna screen o servicio llama fetch() directamente.
- Los cambios en repositorios deben propagarse a UI vía EventBus, nunca mediante recargas manuales.
- Toda la IA cloud debe pasar por el backend — no hay API keys en el dispositivo.
- Entidades se clasifican en 3 categorías:
  - **Read Only** (users, courses, notifications, analytics) — nunca hacen PUSH.
  - **Bidireccionales** (subjects, assessments, schedules, flashcards, settings, calendar) — siempre participan en CREATE/UPDATE/DELETE/PUSH/PULL/INITIAL/CONFLICT.
  - **Assets** (photos, audio, documents) — MetadataSync y AssetSync son pipelines completamente separados.
- MetadataSync y AssetSync corren como pipelines independientes bajo SyncManager. AssetSync maneja blob/chunk/resume/checksum.
- Cada registro debe tener `sync_version` por entidad (diseñado ahora, implementado después).
- Cada registro debe tener checksum SHA256 (canonical JSON) para detectar corrupción silenciosa.
- `sync_queue` debe evolucionar a Event Store con traceId, version, dependsOn, retry, createdAt.
- Compactación debe ser una máquina de reducción (SyncQueueReducer) con reglas declarativas, no cascadas de if/else.
- SyncQueueReducer debe ser una **función pura**: recibe operaciones, devuelve operaciones reducidas + ReductionReport. No escribe en SQLite, no hace HTTP, no modifica sync_queue.
- Reducción por **estado final**, no por pares: modela el historial completo de la entidad y decide el resultado, no depende del orden de recorrido.
- Reducer debe soportar agrupación por entidad (todas las ops de un entity_type+entity_id se reducen juntas).
- Reducer debe generar operación RESTORE para secuencias DELETE+CREATE (mismo ID).
- Toda sincronización debe tener un traceId único compartido a través de todo el pipeline (SQLite → Queue → HTTP → Controller → Repository → SQLite).
- Debe existir un RetryPolicy con manejo diferenciado por código HTTP (429→wait/retry, 500→retry, 401→refresh+retry, 404→discard, 409→ConflictResolver).
- Después de cada sync debe generarse un Consistency Report: uploaded/downloaded/conflicts/queueRemaining/backendVersion/sqliteVersion/status.
- Debe existir un SyncValidator que compare conteos, checksums, versiones y missing IDs por entidad.
- Toda la suite de sync debe ser testeable con escenarios reproducibles (Sync Test Suite).
- AI architecture (Policy Engine → Orchestrator → Capabilities) congelada; no más refactors de IA.

## Principio Rector
"Si no puedes observar una sincronización, no puedes confiar en ella."

## Progress
### Done
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

### In Progress (Sync Verification Suite)
- 🟡 **Test Harness** — batería de 10+ escenarios automatizados con FaultInjector, ScenarioRunner, y métricas por escenario.
- 🟢 **Corrección de bugs reales** encontrados por SyncValidator/SyncDebugger.

### Backlog
- **Consistency Report** — al finalizar cada sync: uploaded/downloaded/conflicts/queueRemaining/backendVersion/sqliteVersion/status.
- **Sync Test Suite expansion** — escenarios adicionales (initial sync, delta sync, conflictos, soft-delete, red intermitente).

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
2. **Sync Test Suite expansion** — escenarios adicionales: initial sync, delta sync, conflictos, soft-delete, intermitencia de red.
3. **Optimization** — usando métricas del Test Harness para identificar cuellos de botella.
4. **Corregir bugs** encontrados por SyncValidator/SyncDebugger:
   - backend: sync_version nunca se incrementa
   - backend: deletes son duros, no generan sync_deletions
   - backend: initialSync cubre solo 6 entidades, deltaSync solo 5 tablas
   - mobile: entidades faltantes en ciclos de sync

## Hallazgos Críticos del Audit
- **sync_version nunca se incrementa** en backend — ningún controller llama a `UPDATE sync_version SET version = version + 1` ni `SET sync_version = <next>` en las tablas de entidad. `syncController.js` ejecuta `WHERE sync_version > ?` que siempre devuelve vacío.
- **initialSync cubre solo 6 entidades** (user, courses, subjects, assessments, schedules, flashcardDecks). Faltan photos, audio, scanned_documents, analytics, settings, calendar, notifications.
- **deltaSync cubre solo 5 tablas** + sync_deletions. Mismas entidades faltantes.
- **Backend deletes son duros** (DELETE FROM subjects WHERE id = ?), no generan entradas en sync_deletions.
- **SyncService.ts ordenamiento incompleto**: ~15 entity types caían en rank 99 (sin orden garantizado) — **resuelto** vía DependencyResolver con 28+ entity ranks.
- **SyncQueue compactación parcial**: UPDATE dedup y CREATE→DELETE cancel existían, pero [UPDATE, UPDATE, DELETE] sin collapse — **resuelto** vía SyncQueueReducer con reducción por estado final.

## Relevant Files
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

### Backend
- `backend/controllers/syncController.js` — initialSync (6 entities) + deltaSync (5 tables)
- `backend/controllers/subjectsController.js` — NO sync_version increment
- `backend/controllers/coursesController.js` — NO sync_version increment
- `backend/controllers/assessmentsController.js` — NO sync_version increment
- `backend/controllers/schedulesController.js` — NO sync_version increment
- `backend/controllers/photosController.js` — NO sync_version increment
- `backend/controllers/audioController.js` — NO sync_version increment
- `backend/controllers/documentsController.js` — NO sync_version increment
- `backend/database/migrations/add-sync-version.js` — Creates sync_version table + columns (but never incremented)
- `backend/db.js` — Database init (no write middleware)

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
