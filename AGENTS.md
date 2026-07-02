# Session Context

## Goal
- **[Protocol v1.0]** Sync engine convergence validated: all sync decisions ordered exclusively by version (`sync_version` for mutations, `deletion_version` for deletions). `deleted_at` is audit/metadata only.
- **Stress Suite**: reproducible simulation engine with configurable devices (2/3/5/10), 5 perturbation types (kill/resume, simultaneous sync, random latency, packet loss, server restart, partial sync), SyncMetrics tracking (Convergence Score, sync timing P95, queue depth, conflicts, retries, per-op timing), and tiered runner (smoke/regression/nightly).
- **Asset pipeline**: integrate into the same simulation engine.

## Constraints & Preferences
- Test framework must simulate two devices (A, B) syncing through a real backend.
- Each sync cycle: push queue → pull delta → verify convergence.
- No refactor of stable backend code without clear functional gain — except confirmed bugs found by the test framework itself.
- `deletion_version` migration follows phased plan (Schema → Dual Write → Delta Sync → Test Validation → Cleanup) to keep the system functional at each step.

## Constraints & Preferences
- No comentar código a menos que sea estrictamente necesario.
- No refactorizar código estable sin ganancia funcional clara.
- SQLite como única fuente de verdad para datos de negocio; MMKV reservado para JWT, tokens, flags, configuración, metadatos.
- La capa UI no debe importar directamente de `services/api`; debe hacerlo vía DataStore, Repositories o Queries.
- Mantener el orden de secciones del template.

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

### In Progress
- 🟢 **Sync Protocol v1.0 document** — `SYNC_PROTOCOL.md`: estructura de eventos, initial/delta/push flow, conflict resolution, versionado, deletion_version, códigos de error, garantías.
- 🟢 **Stress Suite — RandomScenario** — 4 segmentes (normal/heavy_perturbations/offline/normal), ConsistencyReport final, tier runner integrado.
- 🟢 **Consistency Report** — `ConsistencyReport.js` ejecutable post-suite: entidades (15 tablas B vs D0), integridad (FK orphans, duplicate PKs), colas (pending/failed), versiones (backend/device/max_table).
- 🟢 **deletion_version — Fase 5 (Cleanup)**: Confirmado — **cero decisiones de sync dependen de `deleted_at`**.
- 🟢 **Sprint 2 (Assets) — Pipeline completo**: Infraestructura creada (AssetSyncEngine, colas upload/download, PersistentLocalAssetStore, 3 synchronizers, AssetValidator). Integrado en SyncManager. Upload wiring en api/photos/audio/documents. Priority download en ImageViewerModal. **audio_transcripts** ya incrementa sync_version correctamente. Convergence Suite + Stress Suite verifican integridad.
- 🟢 **Product Audit Phase**: 4 documentos de auditoría de producto creados (FEATURE_MATRIX, USER_JOURNEYS, MUTATION_MATRIX, OWNERSHIP_MATRIX). El tipo de auditoría cambió de "¿el sync funciona?" a "¿la aplicación permite completar el ciclo de vida?".

### Next Steps
1. ✅ **Stress Suite expansion** — RandomScenario (4 segmentos, Consistency Report) corriendo en tier runner (`node index.js random`).
2. ✅ **Assets pipeline** — integrado en SimulationEngine + Convergence Suite + Stress Suite. **audio_transcripts** corrigió `incrementSyncVersion` faltante.
3. 🟡 **Cerrar brechas funcionales de FEATURE_MATRIX.md** — Priorizar brechas donde backend ya soporta la operación pero falta UI. Las 5 matrices son la fuente de verdad del ciclo de vida de cada entidad. Orden:
    1. Priority High (UI faltante, backend listo): duplicar mazo, re-transcribir, compartir contenido
    2. Priority Medium (relaciones): CASCADE faltante en assessments/schedules/study_sessions
    3. Priority Low (calidad de vida): archivar, resetear estadísticas
4. 🟡 **Cerrar brechas de USER_JOURNEYS.md** — Los 12 journeys son la guía de priorización. El journey "Administrar materia" (53%) y "Mazo compartido" (44%) son los más incompletos. Cada journey debe auditarse antes de cerrar un sprint.
4. 🟡 **EntityRegistry centralizado** — crear registro único de todas las entidades sincronizables para que tests verifiquen automáticamente: toda entidad existe en delta sync, incrementa sync_version, aparece en initial sync y consistency report.
5. 🟡 **Dashboard de salud del Sync Engine** — Convergence Score, stress/consistency status, pending queue, failed journal, retry rate, avg/P95 sync timing.
4. ✅ **Sync Protocol v1.0 document** — `SYNC_PROTOCOL.md` frozen.
5. 🟡 **Migrar `expo-av` → `expo-audio`/`expo-video` y `expo-background-fetch` → `expo-background-task`** antes de SDK 54.
6. 🟡 **Crear tabla SQLite para `user_groups`** y migrar OverallGPA a cálculo/caché local desde SQLite.
7. 🟡 **Refactorizar event handlers** (`deleteSubject`, `createStudySession`, `getPredictedSubject`) para que no importen directamente de `services/api`.

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

### Decisiones previas (congeladas)
- **Dual storage merge**: MMKV canonical for deck+cards; merge with SQLite at read time.
- **Hybrid routing for OCR/PDF extraction**: `extractTextFromImageHybrid` / `extractTextFromPDFHybrid`.
- **Inline safe-area padding for modals**: `useSafeAreaInsets()` with inline `paddingBottom`.
- **Hub: useCallback for SectionList handlers**: preserve `React.memo`.
- **Hub: Deep link strategy**: `vnd.youtube:` + `Linking.openURL(https)` + WebBrowser fallback.
- **AI: Policy Engine → Orchestrator → Capabilities**: frozen, no more AI refactors.

## Next Steps
1. ✅ **Stress Suite expansion** — RandomScenario (4 segmentos, Consistency Report) corriendo en tier runner (`node index.js random`).
2. ✅ **Assets pipeline** — integrado en SimulationEngine + Convergence Suite + Stress Suite. **audio_transcripts** corrigió `incrementSyncVersion` faltante.
3. 🟡 **Cerrar brechas funcionales de FEATURE_MATRIX.md** — Priorizar brechas donde backend ya soporta la operación pero falta UI. Las 5 matrices son la fuente de verdad del ciclo de vida de cada entidad. Orden:
    1. Priority High (UI faltante, backend listo): duplicar mazo, re-transcribir, compartir contenido
    2. Priority Medium (relaciones): CASCADE faltante en assessments/schedules/study_sessions
    3. Priority Low (calidad de vida): archivar, resetear estadísticas
4. 🟡 **Cerrar brechas de USER_JOURNEYS.md** — Los 12 journeys son la guía de priorización. El journey "Administrar materia" (53%) y "Mazo compartido" (44%) son los más incompletos. Cada journey debe auditarse antes de cerrar un sprint.
5. 🟡 **EntityRegistry centralizado** — crear registro único de todas las entidades sincronizables para que tests verifiquen automáticamente: toda entidad existe en delta sync, incrementa sync_version, aparece en initial sync y consistency report.
6. 🟡 **Dashboard de salud del Sync Engine** — Convergence Score, stress/consistency status, pending queue, failed journal, retry rate, avg/P95 sync timing.
7. ✅ **Sync Protocol v1.0 document** — `SYNC_PROTOCOL.md` frozen.
8. 🟡 **Migrar `expo-av` → `expo-audio`/`expo-video` y `expo-background-fetch` → `expo-background-task`** antes de SDK 54.
9. 🟡 **Crear tabla SQLite para `user_groups`** y migrar OverallGPA a cálculo/caché local desde SQLite.
10. 🟡 **Refactorizar event handlers** (`deleteSubject`, `createStudySession`, `getPredictedSubject`) para que no importen directamente de `services/api`.

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

### Data Layer
- `mobile/src/services/database/BaseRepository.ts` — Now uses ConflictResolver on upsert
- `mobile/src/services/database/DatabaseService.ts` — Transaction support
- `mobile/src/services/database/repositories/CourseRepository.ts` — SQLite CRUD
- `mobile/src/services/database/appInit.ts` — Bootstrap and sync handler
- `mobile/src/services/database/migrations.ts` — v20 (SyncJournal), v21 (version_number/last_modified_by/deleted_at), v22 (sync_debug_logs + trace_id)

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
