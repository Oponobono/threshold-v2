# Session Context

## Goal
- **[Protocol v1.0]** Sync engine convergence validated: all sync decisions ordered exclusively by version (`sync_version` for mutations, `deletion_version` for deletions). `deleted_at` is audit/metadata only.
- **Stress Suite**: reproducible simulation engine with configurable devices (2/3/5/10), 5 perturbation types (kill/resume, simultaneous sync, random latency, packet loss, server restart, partial sync), SyncMetrics tracking (Convergence Score, sync timing P95, queue depth, conflicts, retries, per-op timing), and tiered runner (smoke/regression/nightly).
- **Asset pipeline**: integrate into the same simulation engine.
- **[Knowledge Domain — Sprints 1–3 ✅]** FSRS consolidado como única fuente de verdad. `KnowledgeProjection` → `KnowledgeSnapshot` (Value Object inmutable). Primer consumidor (KnowledgeHealthCard) validado en Dashboard. FSRS, SQLite y retrievability encapsulados detrás de `KnowledgeProvider`. Dominio congelado — próximos sprints validan valor, no amplían.

## Architecture Invariants
Estas reglas no son tareas ni roadmap. Son invariantes arquitectónicos. Cualquier propuesta que las rompa debe justificar por qué el invariante ya no aplica.

1. **Bootstrap nunca espera red.** Solo SQLite y MMKV bloquean el arranque. NETWORK, AUTH y SYNC son fire-and-forget.
2. **SQLite es la fuente de verdad local.** MMKV es solo para JWT, tokens, flags, configuración y metadatos.
3. **Los consumidores nunca conocen el motor subyacente.** Dashboard, IA, Calendario y Notificaciones solo conocen contratos (KnowledgeProvider, Repository). No importan FSRS, SQLite, retrievability ni API HTTP.
4. **FSRS es la única fuente de verdad del conocimiento.** Toda métrica cognitiva (retrievability, dificultad, estabilidad) nace de FSRS. Prohibido proxies estadísticos (failure_rate, success_rate).
5. **KnowledgeSnapshot es un Value Object inmutable.** Nadie lo muta parcialmente. Cada buildSnapshot() genera una nueva instancia. Object.freeze() en runtime.
6. **El dominio solo crece cuando un consumidor real lo justifica.** No se agregan propiedades al Snapshot por anticipación ("podría necesitarse"). El flujo es: consumidor real → necesidad demostrada → ampliación → tests → documentación.
7. **La red actualiza el estado local; nunca habilita el arranque.** El flujo es: Servidor → Sincronización → SQLite → Repository → UI. Nunca: Servidor → UI.
8. **La UI nunca depende del resultado de un refresh remoto.** Perfil local → UI → refresh remoto → SQLite → UI se actualiza reactivamente. Si el refresh falla, la UI ya tiene datos locales.

## Constraints & Preferences
- Test framework must simulate two devices (A, B) syncing through a real backend.
- Each sync cycle: push queue → pull delta → verify convergence.
- No refactor of stable backend code without clear functional gain — except confirmed bugs found by the test framework itself.
- `deletion_version` migration follows phased plan (Schema → Dual Write → Delta Sync → Test Validation → Cleanup) to keep the system functional at each step.
- No comentar código a menos que sea estrictamente necesario.
- No refactorizar código estable sin ganancia funcional clara.
- La capa UI no debe importar directamente de `services/api`; debe hacerlo vía DataStore, Repositories o Queries.
- Mantener el orden de secciones del template.

### Logcat Commands Reference
```powershell
# Capturar logs de la app por paquete
adb logcat -d | Select-String "com.oponobono.threshold" > crash.log

# Filtrar por boots
Select-String -Path "crash.log" -Pattern "BOOT"

# Filtrar por módulos nativos
Select-String -Path "crash.log" -Pattern "llama|whisper|reanimated|skia|nitro|sqlite"

# Filtrar por fallos fatales
Select-String -Path "crash.log" -Pattern "FATAL|SIGSEGV|SIGABRT|dlopen"

# Captura limpia en vivo (borra buffer + filtra por tag)
adb logcat -c; adb logcat -s "ReactNativeJS" > crash2.log

# Captura del buffer completo post-ejecución
adb logcat -d > "$env:TEMP\crash3.log"
Move-Item "$env:TEMP\crash3.log" "C:\Users\cris7\OneDrive\Desktop\crash3.log"
```

## Principio Rector
"Si no puedes observar una sincronización, no puedes confiar en ella."

## Definiciones

**Entidad persistente**: Existe en la base de datos. No necesariamente participa en sincronización. Ej: logs, analytics, cache.

**Entidad sincronizable**: Cumple todos los invariantes del protocolo. Es una ciudadana de primera clase del Sync Engine.

## Invariantes del Protocolo (Sync Entity Contract)
1. Toda entidad sincronizable posee `user_id`.
2. Toda entidad sincronizable posee `sync_version`.
3. Toda mutación (CREATE/UPDATE) incrementa `sync_version`.
4. Toda eliminación genera `deletion_version` en `sync_deletions`.
5. Toda entidad participa en **Initial Sync**.
6. Toda entidad participa en **Delta Sync**.
7. Toda entidad participa en **Push** (endpoint + cola).
8. Toda entidad participa en **Backup/Restore** (cuando aplique).
9. Toda entidad aparece en el **Consistency Report**.
10. Toda entidad está cubierta por la **Stress Suite** o por un **escenario específico** de convergencia.

*Si una tabla rompe cualquiera de estas reglas, no es una entidad sincronizable. Es solo una tabla.*

## Políticas de Tablas No Sincronizables

### card_logs — Auditoría histórica (NO sincronizable)
`card_logs` es una tabla de auditoría histórica de repasos. Sus registros:
- Nunca participan en sincronización lógica ni restauración del agregado Subject.
- No poseen `deleted_at`, `sync_version`, ni las columnas del protocolo de sincronización.
- Se conservan indefinidamente incluso cuando el `card_id` o `flashcard` padre es soft-deleted.
- Son la fuente de verdad para analytics, métricas FSRS y estadísticas históricas.
- Quedan excluidos intencionalmente del CASCADE de Subject→hijos.

**Regla**: cualquier entidad sin `sync_version` ni `deleted_at` no forma parte del agregado Subject y no debe ser cascada por `deleteSubject()`.

La incorporación de una nueva entidad sincronizable no se considera completa hasta que todos los invariantes sean verificables mediante pruebas automáticas (Convergence Suite, Stress Suite, Consistency Report).

## Progress
### Done
- **[*NUEVO*] F12 — Double version bump corregido**: `BaseRepository.update()` ahora honra `version_number` explícito cuando se pasa. Sin él, auto-incrementa `COALESCE(version_number,0)+1` como antes. Elimina el doble salto que ocurría vía `ConflictResolver` + `update()`.
- **[*NUEVO*] F5 — sync_version guard en todos los UPDATEs del backend**: 4 endpoints (`updateSubject`, `updateCourse`, `updateFlashcardDeck`, `updateCardStatus`) ahora comparan `sync_version` entrante contra el actual. Rechazan con 409 si el cliente está obsoleto. Helper `updateWithVersionGuard()` en `syncVersion.js`.
- **[*NUEVO*] F4 — version guards en CREATEs restantes**: `createSubject` (migrado de SELECT-then-INSERT a `ON CONFLICT` con guard), `createCourse` y `createFlashcardDeck` ahora incluyen `WHERE sync_version IS NULL OR sync_version <= ?` en su `ON CONFLICT DO UPDATE SET`.
- **[*NUEVO*] F8 — createSubject idempotente**: Reemplazado el patrón `SELECT → INSERT` race-condition-prone por `INSERT ... ON CONFLICT(id) DO UPDATE SET`. RESTORE de subjects ya no falla con duplicate key.
- **[*NUEVO*] F1/F11 — GET-before-PUT conflict check eliminado**: El `syncHandler` ya no hace GET silencioso previo al PUT. El servidor rechaza actualizaciones obsoletas con 409 (vía F5). El `SyncService` reintenta automáticamente. Se agregó mapeo `version_number → sync_version` en el payload.
- **[*NUEVO*] F7 — RESTORE limpia sync_deletions**: `createSubject`, `createCourse`, `createFlashcardDeck` ahora llaman `removeDeletion()` tras upsert exitoso. Previene borrados fantasma en otros clientes tras una secuencia DELETE+CREATE.
- **[*NUEVO*] F13 — deltaSync total counter miscalculated**: `total = allTableKeys.length + 1` = 16, but there are 17 completion increments (14 regular tables + 1 special table + 1 deletion query + 1 sync version fetch). Caused one query's data to always be silently dropped from every delta sync response (`updated` miss one table, `_syncVersion = 0`). Fixed: `total = allTableKeys.length + 2`. Detected by convergence test scenario 007 returning `entities=1` instead of 2 after offline-then-sync.
- **Sync Protocol v1.0 document**: `SYNC_PROTOCOL.md` — estructura de eventos (queue → reducer → RESTORE semantics), initial/delta/push flow, conflict resolution (4 estrategias: LWW/CLIENT/SERVER/MERGE), versionado (sync_version/deletion_version/version_number), borrado (soft delete + sync_deletions + cascade), error codes (409/404/400/5xx), garantías (idempotencia, monotonía, convergencia, at-least-once), asset pipeline overview. — estructura de eventos (queue → reducer → RESTORE semantics), initial/delta/push flow, conflict resolution (4 estrategias: LWW/CLIENT/SERVER/MERGE), versionado (sync_version/deletion_version/version_number), borrado (soft delete + sync_deletions + cascade), error codes (409/404/400/5xx), garantías (idempotencia, monotonía, convergencia, at-least-once), asset pipeline overview.
- **RandomScenario generator**: `StressSuite/RandomScenario.js` — 4 segmentes (normal/heavy_perturbations/offline/normal) con pesos específicos, ConsistencyReport al final, 100×2 PASS (100% convergence, 0 errores, 31 conflictos detectados).
- **Stress Suite v2**: SimulationEngine expandido con devices configurables (2/3/5/10), 5 tipos de perturbación (simultaneous sync, latencia aleatoria, pérdida de paquetes, reinicio de servidor, sincronización parcial), SyncMetrics con Convergence Score y métricas detalladas (P95, profundidad de cola, reintentos, conflictos, tiempos por operación), y runner por niveles (smoke/regression/nightly/custom/random). Smoke 100×2 PASS, Regression 1000×3 PASS con 1056 conflictos y 0 errores.
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
- **FEATURE_MATRIX.md**: Documento funcional expandido a 5 matrices: Lifecycle (26+ entidades, 4 capas cada una), State Machine (5 entidades con estados documentados), Relationship (FK + cascade + 3 riesgos), Capability (IA por entidad), Offline (CRUD + IA + assets). Detecta 20+ brechas funcionales. El documento ahora gobierna el desarrollo: toda entidad nueva debe completar su fila antes de implementarse.
- **USER_JOURNEYS.md**: 12 recorridos completos del usuario (120 pasos totales). 61% de completitud funcional detectada. El journey "Administrar materia" es el más incompleto (53%). El journey "Backup/Restore" es el más completo (80%).
- **MUTATION_MATRIX.md**: 30+ acciones mapeadas con sus entidades afectadas. Detecta 9 mutaciones faltantes, incluyendo la más crítica: eliminar Subject no hace cascade en Courses, Assessments, Schedules, ni StudySessions.
- **OWNERSHIP_MATRIX.md**: Árbol de propiedad completo con 25 relaciones. Identifica 5 riesgos de orphan data por CASCADE faltante en relaciones Subject→hijos.
- **Desvincular examen de mazo**: Brecha funcional corregida — la UI ahora permite desvincular un examen de un mazo. Tres puntos de entrada:
  1. Botón "Quitar vínculo" + icono X en `LinkExamModal.tsx` junto al examen vinculado actualmente.
  2. Swipe action con icono link rojo en `flashcards.tsx` cuando el mazo tiene `linked_event_id`.
  3. `handleUnlink` en `LinkExamModal.tsx` limpia `linked_event_id` del mazo y remueve el deck del CSV `linked_deck_id` del evento.
  Backend ya soportaba `PUT /flashcard-decks/:deckId` con `{ linked_event_id: null }` — solo faltaba UI.
- **Sprint 1 — K0 (Cimentación FSRS)**: Consolidar FSRS como única fuente de verdad del conocimiento.
  - `integrity.ts` — detección de datos FSRS corruptos.
  - Migration v30 — `last_review_timestamp` + valores por defecto para parámetros FSRS.
  - Activación del modo Production en FSRS.
  - Refactor de `ReviewScheduler`: eliminación completa de `failure_rate`; adopción de retrievability como métrica única.
  - `getKnowledgeAggregation()` — una única consulta SQL; agregación en memoria preparada para KnowledgeSnapshot.
- **Sprint 2 — K1 (KnowledgeSnapshot)**: Crear una proyección inmutable del dominio desacoplada de FSRS y SQLite.
  - `KnowledgeSnapshot`, `LearningHealth`, `SubjectKnowledge` en `types.ts`.
  - `KnowledgeSnapshotBuilder` — builder puro, snapshot completamente inmutable (`Object.freeze`).
  - `KnowledgeProjection` — orquestador DB → Query → Builder → Snapshot.
  - `KnowledgeProvider` — contrato estable para consumidores.
  - 19 pruebas automatizadas: determinismo, confidence, memoryLevel, edge cases, inmutabilidad.
- **Sprint 3 — Primer consumidor (KnowledgeHealthCard)**: Validar que un consumidor real puede utilizar el Snapshot sin conocer el dominio.
  - `useKnowledgeInsights` — hook React con estados loading/error/data + refresh manual.
  - `KnowledgeHealthCard` — componente UI que consume solo `snapshot.health` + `snapshot.metadata`.
  - Integración en Dashboard como capa cognitiva (`Estado de Aprendizaje`) junto a la capa operativa existente (`Repasos urgentes`).
  - Documentado en `docs/architecture/Sprint3-KnowledgeHealthCard.md`.
- **[Sesión Jul 2026] Bootstrap + Migraciones estabilizados**:
  - Migration v30 corregida (`fsrs_repetitions` antes de UPDATE).
  - Migration v31 convertida a no-op (historial congelado).
  - `withExclusiveTransactionAsync` eliminado de `SubjectDomainService` → `BEGIN IMMEDIATE`/`COMMIT` manual.
  - WAL mode verificado: no era el culpable — la BD existente estaba corrupta.
  - `PRAGMA wal_checkpointer(TRUNCATE)` en error handler solo si error "locked".
  - `initializeApiClient()` nunca bloquea bootstrap (ni en fresh install).
  - Backend detection pasó de ~12s a ~0.44s con MMKV cache + background health check.
- **[*NUEVO*] CASCADE Subject→hijos auditado y completado**: 15 tablas auditadas con subject_id directo o relación anidada. Se agregaron 4 entidades faltantes (ai_chats, assessment_files, audio_transcripts, youtube_transcripts). Cascade profundo validado: Subject→Assessment→Files, Subject→Audio→Transcripts, Subject→YouTube→Transcripts. Se excluyó card_logs intencionalmente (datos históricos de review). Tests: 12/12 PASS.
- **Sync Protocol v1.0 document** — `SYNC_PROTOCOL.md` frozen: estructura de eventos, initial/delta/push flow, conflict resolution, versionado, deletion_version, códigos de error, garantías.
- **Stress Suite** — RandomScenario (4 segmentos), ConsistencyReport, tier runner integrado (smoke/regression/nightly/custom/random).
- **Consistency Report** — `ConsistencyReport.js` ejecutable post-suite: entidades (15 tablas B vs D0), integridad (FK orphans, duplicate PKs), colas, versiones.
- **deletion_version — Fase 5 (Cleanup)** — Confirmado: cero decisiones de sync dependen de `deleted_at`.
- **Sprint 2 (Assets) — Pipeline completo** — AssetSyncEngine, colas upload/download, PersistentLocalAssetStore, 3 synchronizers, AssetValidator. Integrado en SyncManager.
- **Product Audit Phase** — 4 documentos de auditoría (FEATURE_MATRIX, USER_JOURNEYS, MUTATION_MATRIX, OWNERSHIP_MATRIX).
- **[Knowledge Domain — Sprints 1-3]** — FSRS consolidado, KnowledgeSnapshot inmutable + 19 tests, KnowledgeHealthCard en Dashboard.
- **[*NUEVO*] Sprint 6 (Reminder System) completo**: 23 suites, 275 tests, 0 failures. Propiedades fundamentales demostradas (Event Storm, Session Isolation, Delta Convergence, Resync). Dominio puro sin dependencias de infraestructura.
- **[*NUEVO*] Sprint 6.3 — Frontera dominio/infraestructura blindada**: `createDefault()` y `loadDefaultRepos()` extraídos de `ReminderCoordinator` a `ReminderSystemFactory.ts` (composition root). `createDefaultRepos()` extraído de `ReminderSnapshotBuilder`. 3 bugs latentes corregidos en la fábrica: `registry.register()` pasaba constructores en vez de instancias, `InterruptionPolicy` sin `Clock`, `TemplateResolver` sin `I18nService`. Todos los archivos de dominio ahora son puros — 0 imports de infraestructura en runtime.
- **[*NUEVO*] Reminder Regression Suite**: `ReminderRegression.test.ts` — 10 tests que cubren los 8 escenarios críticos (Event Storm, Session Isolation, Delta Convergence, Resync, Logout/Login, Double initialize, Double destroy, Event Repetition). Comando: `npx jest --testPathPattern "ReminderRegression"`.
- **Sprint 7 — Performance Observability**: `PerformanceObserver` (interface domain), `MetricsCollector` (ring buffer + summarize: avg/p50/p95/max), `NullObserver`. Instrumentados 6 stages del pipeline: `snapshot_builder.build`, `entity.build`, `collect_sequences`, `interruption.resolve`, `templates.enrich`, `reconciler.sync`. Integrados en `EngineTraceEntry.stages`. Zero cambios de comportamiento con default NullObserver.
- **[*FIX*] Deep link disconnect**: `_layout.tsx` ahora lee `data.deeplink` del Reminder Engine primero, con fallback a legacy `data.type`. `NavigationContract.ts` creado con `parseDeeplink()` y `getTargetRoute()` — contrato documentado entre el dominio y la app. 15 tests nuevos. El handler legacy ignoraba los deep links del Engine (threshold://assessments/{id}, etc.).
- **Reminder System — Engineering Complete (Stable)**: 24 suites, 290 tests, 0 failures. Core, integración, validación, observabilidad, bug de integración corregido. El subsistema se declara estable. El trabajo restante (UX, permisos, validación en dispositivos) pertenece a producto, no a ingeniería del subsistema.

### In Progress
*(Ver Fase Actual → Pendiente)*

## Fase Actual: Consolidación del Núcleo

Progreso estructurado en sprints dentro de la fase actual. Cada sprint tiene alcance cerrado y criterios de salida definidos.

### Sprint 1 — CASCADE de Subject (Integridad del Agregado) ✅
*Cerrado. 12/12 tests PASS.*

Objetivo: garantizar que eliminar un Subject no deje huérfanos en ninguna tabla dependiente.

| Invariante | Estado |
|---|---|
| assessments → assessment_files | ✅ Cascade verificado |
| audio_recordings → audio_transcripts | ✅ Cascade verificado |
| youtube_videos → youtube_transcripts | ✅ Cascade verificado |
| flashcard_decks → flashcards | ✅ Cascade verificado |
| ai_chats (subject_id directo) | ✅ Agregado |
| FKs sin orphan data post-delete | ✅ Verificado |
| sync_queue compactada por entidad afectada | ✅ Verificado |
| event bus notifica borrado por tipo | ✅ Verificado |
| card_logs excluido (política documentada) | ✅ Intencional |

### Sprint 2 — Observabilidad y Performance Budgets 🟡 *Pendiente*
*Planificado. No iniciado.*

No se toca lógica de dominio. Solo instrumentación.

Objetivo: que cualquier degradación futura sea detectable sin necesidad de debugging manual.

#### Instrumentación planificada

| Métrica | Dónde |
|---|---|
| `KnowledgeSnapshot.build()` — duration, subjectCount, deckCount, flashcardCount, memoryUsed | `KnowledgeProjection.ts` |
| Cache hit/miss rate | `useKnowledgeInsights.ts` |
| Razón de reconstrucción (builds totales / builds necesarias) | `KnowledgeProjection.ts` |
| Tiempo de notificación a consumidores | `repositoryEventBus` |
| Bootstrap total | `BootstrapManager.ts` |
| `deleteSubject()` timing | `SubjectDomainService.ts` |

#### Performance budgets (referencia inicial)

| Métrica | Objetivo |
|---|---|
| Bootstrap completo | < 1 s |
| KnowledgeSnapshot.build() | < 100 ms |
| Carga inicial del DataStore | < 1.5 s |
| Eliminación completa de Subject | < 300 ms |
| Health check conocido | < 500 ms |

**Regla del sprint**: medir, no optimizar. Si una métrica excede el presupuesto, se documenta pero no se corrige hasta tener datos de al menos 7 días de uso real.

### Sprint 3 — Feature Matrix (Cierre de Brechas Funcionales) 🟡 *Pendiente*
*Depende de Sprint 2.*

Recién aquí se vuelve a agregar funcionalidad. Prioridad por brecha donde backend ya soporta la operación pero falta UI.

| Feature | Impacto | Backend |
|---|---|---|
| Duplicar mazo | Alto | ✅ Listo |
| Re-transcribir audio | Alto | ✅ Listo |
| Compartir contenido | Alto | ✅ Listo |
| Archivar materia | Bajo | Parcial |
| Resetear estadísticas | Bajo | Parcial |

### Batería de Regresión (permanente, paralela a los sprints)

Pruebas que se ejecutan en < 15s y aseguran que no se reintroduzcan bugs críticos:

- **[Reminder System]** `npm run test:regression` (10 tests, 8 escenarios)
  → CI gate: `.github/workflows/reminder-regression.yml`
- *Pendiente:* Instalación limpia → bootstrap OK
- *Pendiente:* Migración 0→31 completa
- *Pendiente:* Abrir/cerrar BD 100 veces sin `database is locked`
- *Pendiente:* Crear Subject con todas las entidades hijas
- *Pendiente:* Eliminar Subject con cascade (assert 0 orphans)
- *Pendiente:* Sincronización inicial (2 dispositivos, converge)
- *Pendiente:* Login → logout → login
- *Pendiente:* Restaurar backup (con y sin datos locales)
- *Pendiente:* Stress Suite smoke (100×2)

**Comandos**:
- `npm test` — Jest completo
- `npm run test:regression` — Solo Regression Suite (10 tests, ~15s)
- `npm run test:ci` — Suite completa del Reminder System (290 tests)
- **Gate CI**: se activa en PRs contra `mobile/src/services/reminders/**`. Ejecuta regression suite primero (fallo rápido), luego full suite.

### Blocked
- *(none)*

## Key Decisions
### Bootstrap desacoplado de red (Jul 2026)
- **Problema aparente**: Pantalla blanca al iniciar APK Release. Sospecha inicial: migraciones o módulos nativos (llama.rn, whisper.rn, skia, reanimated, sqlite).
- **Problema real 1 (funcional)**: AUTH phase (`getCurrentUserProfile()` HTTP) bloqueaba el bootstrap hasta 10.6s, causando timeout de 15s. En PID 19113: AUTH tardó 10.6s de 10.8s totales. En PID 20095 (reintento con cache warm): 0.4s de 0.5s totales. SDK 54, Hermes, New Architecture — módulos nativos cargaban correctamente (NitroMmkv, expo-sqlite, reanimated todos `ok`).
- **Problema real 2 (visual)**: `useColorScheme()` retornaba `undefined` antes de resolver a `'dark'`, causando que `colorScheme === 'dark'` fuese `false` y se usara `DefaultTheme` (background blanco) en `ThemeProvider` de React Navigation durante un frame fugaz. El splash nativo (#0E0E18) y el windowBackground de Android (#0E0E18) ya coincidían — no era un desajuste de color.
- **Evolución del diagnóstico**: Pantalla blanca → ¿Migraciones? → ¿DatabaseProvider? → ¿ErrorBoundary? → Instrumentación BOOT → AUTH tarda 10s → Bootstrap depende de red → Rediseño Local-First → Flash blanco restante → Theme inicial de React Navigation → Problema resuelto.
- **Solución**: NETWORK, AUTH y SYNC pasan a ser fases fire-and-forget. Solo DATABASE (SQLite) y STORAGE (MMKV) son bloqueantes. La UI arranca con perfil local y se actualiza reactivamente cuando el refresh remoto completa. `ThemeProvider` cambió de `colorScheme === 'dark'` a `colorScheme !== 'light'` para que `undefined` (antes de resolver) use DarkTheme en vez de DefaultTheme.
- **Resultado**: Bootstrap determinista de ~1.4s en APK Release. Cero `await` sobre red en el camino crítico. Separación clara entre inicialización local y sincronización remota.
- **Instrumentación permanente**: [BOOT 00–15] se mantienen como boot tracing del proyecto.
- **Pruebas pendientes**: 6 escenarios de estrés de arranque (instalación limpia con/sin red, backend lento/caído, 20 reinicios forzados, reinicio de teléfono).

## Gold Rule (post-architecture-freeze)
- No new module if an existing one can solve the problem without losing clarity.
- No abstraction "just in case". Every new layer must justify what problem it solves.
- The architecture is stable enough to build on for a long time. Optimize, don't restructure.
- A partir de ahora: toda hora de desarrollo debe aumentar la confianza en el sistema, no su complejidad. Medir, validar, automatizar pruebas, corregir bugs con evidencia.

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

### Threshold: De código a dominio
- El proyecto cruzó el umbral de estar organizado alrededor del código a estarlo alrededor del dominio.
- Ahora el conjunto de documentos (SYNC_PROTOCOL, FEATURE_MATRIX, USER_JOURNEYS, MUTATION_MATRIX, OWNERSHIP_MATRIX, AGENTS) constituye la especificación funcional del producto, no documentación técnica.
- **Regla de gobierno a partir de ahora**: No implementar una funcionalidad nueva mientras exista un ciclo de vida incompleto en una funcionalidad existente. Antes de agregar X, verificar:
  - ¿El usuario puede crearlo, editarlo, moverlo, vincularlo/desvincularlo, eliminarlo, restaurarlo (si aplica)?
  - ¿Funciona offline? ¿Sincroniza? ¿Tiene pruebas?
  - ¿Aparece en las matrices?
- **Proceso madurado**: El ciclo pasó de `Bug → Fix → Siguiente bug` a `Observación → Auditoría → Modelo → Implementación → Tests → Documentación → Regla de gobierno`.
- **Nueva definición de "Done"**: Una funcionalidad está terminada solo cuando completa:
  1. Modelo actualizado (matrices)
  2. Implementación (código)
  3. Convergence Suite (sync)
  4. Stress Suite (resistencia)
  5. Pruebas en dispositivos (campo)
  6. Documentación (matrices actualizadas)
  7. FEATURE_MATRIX.md = ✅ y USER_JOURNEYS.md = ✅ para esa entidad
- **Métricas de seguimiento del proyecto**:
  - **Estabilidad del motor**: Convergence Suite + Stress Suite + tests en dispositivos (¿todo verde?)
  - **Completitud funcional**: % de operaciones completas en FEATURE_MATRIX.md
  - **Completitud de recorridos**: % de pasos completados en USER_JOURNEYS.md
- **Documentos futuros** (cuando el dominio lo requiera):
  - `DOMAIN_MODEL.md`: Qué representa cada entidad (no cómo sincroniza ni cómo se almacena — solo su significado en el dominio).
  - `DECISION_LOG.md` (o ADRs): Registro de decisiones arquitectónicas con contexto, alternativas, y estado (Accepted/Deprecated/Superseded).

### Metodología: Operación Campo
- **Fase 1 — Usar como usuario real**: 1-2 semanas usando la app como herramienta principal de estudio. No probar botones — cumplir objetivos reales ("mañana tengo un parcial").
- **Fase 2 — No arreglar inmediatamente**: Documentar cada hallazgo sin abrir el editor. Cada hallazgo incluye: número, journey, paso, problema, impacto y documento afectado.
- **Fase 3 — Agrupar**: No implementar uno por uno. Agrupar hallazgos por tema (relaciones, compartir, restaurar) y resolver en sprints temáticos.
- **Fase 4 — Matrices como backlog**: FEATURE_MATRIX y USER_JOURNEYS son el backlog vivo. No inventar tareas — las celdas en rojo YA son las tareas.

### Priorización de Hallazgos: Impacto × Frecuencia

| Impacto | Peso | Frecuencia | Peso |
|---------|------|-----------|------|
| No puedo terminar el flujo | 5 | Todos los días | 5 |
| Puedo terminar con dificultad | 4 | Varias veces/semana | 4 |
| Existe workaround | 3 | Semanal | 3 |
| Es incómodo | 2 | Mensual | 2 |
| Detalle visual | 1 | Muy raro | 1 |

**Score = Impacto × Frecuencia**. El backlog se ordena por score descendente.

### Regla del Protocolo: Toda entidad sincronizable debe incrementar sync_version
- El bug `upsertAudioTranscript` demostró que la regla "toda escritura incrementa sync_version" es fácil de olvidar.
- **Solución propuesta**: Centralizar en un helper único `upsertSyncEntity()` que ejecute INSERT/UPDATE + incrementSyncVersion + devolución de datos. Ningún controller nuevo debe llamar `incrementSyncVersion` manualmente.
- **Validación automática futura**: Registrar todas las entidades sincronizables en un `EntityRegistry` central (`subjects`, `courses`, `flashcard_decks`, `flashcards`, `assessments`, `schedules`, `calendar_events`, `grading_periods`, `lms_accounts`, `subject_threshold_overrides`, `photos`, `audio_recordings`, `audio_transcripts`, `scanned_documents`, `youtube_videos`, `youtube_transcripts`). Los tests de convergencia/stress verificarán que toda entidad registrada: (1) existe en delta sync query, (2) incrementa sync_version en cada CREATE/UPDATE, (3) aparece en initial sync.

### Knowledge Domain Architecture (Jul 2026)
- **FSRS es la única fuente de verdad para el estado cognitivo**. ReviewScheduler, Dashboard, IA y cualquier consumidor usan retrievability real de FSRS, no proxies estadísticos (failure_rate, success_rate).
- **KnowledgeSnapshot es un Value Object inmutable**. Nadie lo muta. Cada `buildSnapshot()` genera una nueva instancia. `Object.freeze()` garantiza la inmutabilidad en runtime.
- **Separación estricta**: `KnowledgeProjection` (orquestación) → `KnowledgeSnapshotBuilder` (dominio puro, testeable sin DB) → `KnowledgeSnapshot` (contrato). El Builder puede dividirse en calculadoras especializadas si crece.
- **KnowledgeProvider es el único contrato que conocen los consumidores**. Dashboard, IA, Calendario, Notificaciones no importan FSRS, SQLite, retrievability ni `getKnowledgeAggregation()`.
- **Regla de gobierno del Snapshot**: Ningún consumidor puede solicitar nuevas propiedades al `KnowledgeSnapshot` sin demostrar primero un caso de uso concreto. No se agregan métricas por anticipación.
- **Observabilidad del Snapshot (Sprint 7)**: Instrumentar timing de `buildSnapshot()`, subjects/decks/cards participantes, razón de invalidez/reconstrucción, hit rate de caché. El dominio permanece congelado — no se agregan propiedades sin un consumidor real que lo justifique.
- **Dashboard con capas definidas**:
  ```
  Dashboard
  ├── Capa cognitiva: KnowledgeHealthCard ("¿cómo está mi conocimiento?")
  ├── Capa operativa: Repasos urgentes ("¿qué debo hacer hoy?")
  ├── Próximos repasos
  ├── Actividad reciente
  └── Acciones rápidas
  ```
- **Arquitectura en capas**: SQLite → `getKnowledgeAggregation()` (infraestructura) → `KnowledgeSnapshotBuilder` (dominio) → `KnowledgeSnapshot` (Value Object) → `KnowledgeProvider` (contrato) → UI.
- **Principio rector**: El objetivo de los próximos sprints deja de ser construir más dominio y pasa a ser demostrar que el dominio existente genera valor para el usuario. El dominio permanece congelado hasta que un consumidor real justifique una ampliación.

### Decisiones previas (congeladas)
- **Dual storage merge**: MMKV canonical for deck+cards; merge with SQLite at read time.
- **Hybrid routing for OCR/PDF extraction**: `extractTextFromImageHybrid` / `extractTextFromPDFHybrid`.
- **Inline safe-area padding for modals**: `useSafeAreaInsets()` with inline `paddingBottom`.
- **Hub: useCallback for SectionList handlers**: preserve `React.memo`.
- **Hub: Deep link strategy**: `vnd.youtube:` + `Linking.openURL(https)` + WebBrowser fallback.
- **AI: Policy Engine → Orchestrator → Capabilities**: frozen, no more AI refactors.

## Backlog Técnico (fuera de sprints)

Items que no dependen de la fase actual. Se atienden cuando hay ventana.

- **EntityRegistry centralizado**: registro único de entidades sincronizables para verificación automática (delta sync, sync_version, initial sync, consistency report).
- **Dashboard de salud del Sync Engine**: Convergence Score, stress/consistency status, colas, reintentos, timing P95.
- **Migrar `expo-av` → `expo-audio`/`expo-video`** antes de SDK 54.
- **Migrar `expo-background-fetch` → `expo-background-task`** antes de SDK 54.
- **Crear tabla SQLite para `user_groups`** y migrar OverallGPA a cálculo local.
- **Restore Validator**: `downloadService.ts` como importador en 2 fases (Parse → Validate → Integrity Report → Import).

## Hallazgos Críticos del Audit
- **FOREIGN KEY constraint failed en restore de backup**: `downloadService.ts` falla al restaurar flashcard_decks cuyos `subject_id` ya no existe localmente. Causa raíz: `deleteSubject()` en móvil hace soft-delete SIN cascade local. El backend sí cascadea, pero entre el soft-delete local y la sincronización, un backup captura decks huérfanos. **CORREGIDO** vía `SubjectDomainService.deleteSubject()` con cascade transaccional + journal compaction. Sprint 2 pendiente: IntegrityReport en restore para prevenir inserciones huérfanas.
- **sync_version nunca se incrementa** en backend — ningún controller llama a `UPDATE sync_version SET version = version + 1` ni `SET sync_version = <next>` en las tablas de entidad. `syncController.js` ejecuta `WHERE sync_version > ?` que siempre devuelve vacío. **CORREGIDO** vía helper `syncVersion.js` + 9 controllers.
- **initialSync cubre solo 6 entidades** (user, courses, subjects, assessments, schedules, flashcardDecks). Faltan photos, audio, scanned_documents, analytics, settings, calendar, notifications. **CORREGIDO** — ahora 10 entidades.
- **deltaSync cubre solo 5 tablas** + sync_deletions. Mismas entidades faltantes. **CORREGIDO** — ahora 9 tablas.
- **Backend deletes son duros** (DELETE FROM subjects WHERE id = ?), no generan entradas en sync_deletions. **CORREGIDO** vía `recordDeletion()` en 8 controllers.
- **SyncService.ts ordenamiento incompleto**: ~15 entity types caían en rank 99 (sin orden garantizado) — **resuelto** vía DependencyResolver con 28+ entity ranks.
- **SyncQueue compactación parcial**: UPDATE dedup y CREATE→DELETE cancel existían, pero [UPDATE, UPDATE, DELETE] sin collapse — **resuelto** vía SyncQueueReducer con reducción por estado final.
- **Device Tier RAM disponible vs total**: Usaba RAM disponible (fluctuante) para clasificar. Ahora usa RAM total (estable).
- **Verificación Dashboard**: renderiza 3 veces en dev (StrictMode 2 mounts + refreshProfile). No hay duplicación de requests de red.
- **Flujo Bootstrap**: `Database → Storage → Network (338ms) → Auth → Sync → Momentum → Ready`.
- **`upsertAudioTranscript` sin incrementSyncVersion**: El endpoint `POST /api/audio-transcripts` hacía INSERT/UPDATE en `audio_transcripts` pero nunca llamaba a `incrementSyncVersion`. Esto significaba que transcripciones de audio se guardaban en backend pero **nunca llegaban a otros dispositivos vía delta sync**. **CORREGIDO** — agregado `incrementSyncVersion('audio_transcripts', id)` en ambos paths (INSERT y UPDATE). Hallazgo de la Convergence Suite vía `audio-transcript` generator + Consistency Report.

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
- `backend/controllers/syncController.js` — initialSync (10 entities) + deltaSync (9 tables); **total counter fixed** (allTableKeys.length + 2)
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

### Stress Suite (Fase 2)
- `backend/tests/stress/SimulationEngine.js` — Expandido: 5 perturbaciones (simultaneous sync, latency, packet loss, server restart, partial sync), devices configurables (2/3/5/10), SyncMetrics integration, NetworkController con latency/packet loss
- `backend/tests/stress/SyncMetrics.js` — Métricas: Convergence Score, sync timing (avg/P95/min/max), queue depth, retries, conflicts, discarded by version, per-op timing (CREATE/UPDATE/DELETE/RESTORE)
- `backend/tests/stress/index.js` — Tiered runner: `node tests/stress/index.js smoke` (100×2), `regression` (1000×3), `nightly` (10000×5), `custom <ops> <devices> [seed]`, `random <ops> <devices> [seed]`
- `backend/tests/stress/RandomScenario.js` — 4 segmentes operativos, pesos por segmento, ConsistencyReport final, verificación por checkpoint

### Convergence Test Framework
- `backend/tests/convergence/TestEnvironment.js` — Express + SQLite in-memory, JWT, db injection, TABLE_SCHEMAS, **restart()** method for server restart perturbation
- `backend/tests/convergence/DeviceSimulator.js` — HTTP sync push/pull, own SQLite, dumpAll, sync_version tracking, **metrics hooks**, **latency/packet loss simulation**, **syncPushOnly/syncPullOnly** partial sync
- `backend/tests/convergence/ConvergenceAssert.js` — `deepEqual` (excludes timestamps/metadata), `sameEntities` (excludes version_number), `noQueue`
- `backend/tests/convergence/index.js` — Runner: registerDefaultScenarios(), runAllTests(), PASS/FAIL summary
- `backend/tests/convergence/scenarios/basic.js` — 10 core scenarios covering all sync phases
- `backend/controllers/assessmentsController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/schedulesController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/flashcardsController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/calendarEventsController.js` — incrementSyncVersion + recordDeletion
- `backend/controllers/settingsController.js` — incrementSyncVersion + recordDeletion (grading_periods, lms_accounts, threshold_overrides)
- `backend/controllers/galleryController.js` — incrementSyncVersion + recordDeletion (photos)
- `backend/controllers/audioController.js` — incrementSyncVersion + recordDeletion (audio_recordings, audio_transcripts)
- `backend/controllers/scannedDocumentsController.js` — incrementSyncVersion + recordDeletion (scanned_documents)

### Domain Layer
- `mobile/src/services/domain/SubjectDomainService.ts` — `deleteSubject()` transaccional: cascade 12 entidades hijas + 4 nietos + journal compaction + eventos batch
- `mobile/src/services/domain/invariants.ts` — Invariant checks (requireActiveSubject, etc.)

### Knowledge Domain (Sprint 3 — FSRS como Sistema Nervioso)
- `mobile/src/domain/fsrs/types.ts` — ReviewQuality, ReviewInput, ReviewDecision
- `mobile/src/domain/fsrs/calculateFSRS.ts` — Algoritmo FSRS-4.5 puro
- `mobile/src/domain/fsrs/FlashcardDomainService.ts` — Orquestación de review: FSRS → policy → SQLite → sync
- `mobile/src/domain/fsrs/ReviewSchedulingPolicy.ts` — Modo `production` activado (intervalos FSRS reales)
- `mobile/src/domain/fsrs/calculateElapsedDays.ts` — Cálculo puro de días transcurridos
- `mobile/src/domain/fsrs/integrity.ts` — Detección de datos FSRS corruptos
- `mobile/src/domain/learning/ReviewScheduler.ts` — Agenda de estudio con retrievability real (sin failure_rate legacy)
- `mobile/src/domain/knowledge/retrievability.ts` — Helper puro calculateRetrievability()
- `mobile/src/domain/knowledge/query.ts` — getKnowledgeAggregation(): 1 query SQL para todo el Snapshot
- `mobile/src/domain/knowledge/types.ts` — KnowledgeSnapshot, LearningHealth, SubjectKnowledge, SnapshotMetadata
- `mobile/src/domain/knowledge/KnowledgeSnapshotBuilder.ts` — Builder puro: aggregation → health + subjects + metadata → frozen snapshot
- `mobile/src/domain/knowledge/KnowledgeProjection.ts` — Orquestador DB → Builder (implementa KnowledgeProvider)
- `mobile/src/domain/knowledge/KnowledgeProvider.ts` — Interfaz contrato (único punto de entrada para consumidores)
- `mobile/src/hooks/useKnowledgeInsights.ts` — Hook React: snapshot + loading + error + refresh()
- `mobile/src/components/dashboard/KnowledgeHealthCard.tsx` — Primer consumidor UI: health.score, memoryLevel, forgettingRisk, knowledgeAtRisk, metadata
- `mobile/src/domain/knowledge/__tests__/KnowledgeSnapshotBuilder.test.ts` — 19 tests (determinismo, confidence, memoryLevel, edge cases)

### Data Layer
- `mobile/src/services/database/BaseRepository.ts` — Now uses ConflictResolver on upsert
- `mobile/src/services/database/DatabaseService.ts` — Transaction support
- `mobile/src/services/database/repositories/CourseRepository.ts` — SQLite CRUD
- `mobile/src/services/database/appInit.ts` — Bootstrap and sync handler
- `mobile/src/services/database/migrations.ts` — v20 (SyncJournal), v21 (version_number/last_modified_by/deleted_at), v22 (sync_debug_logs + trace_id)

### Mobile API (enqueue calls)
- `mobile/src/services/api/subjects.ts` — enqueueCreate/Update/Delete for subject; delega en SubjectDomainService para DELETE con cascade
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
