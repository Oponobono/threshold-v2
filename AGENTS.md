# Session Context

## Product Context

Threshold es una **Personal Knowledge Platform** para aprendizaje, construida bajo un enfoque **local-first / offline-first**. El conocimiento del usuario reside y es operable localmente (SQLite como fuente de verdad); la sincronización remota es complementaria (convergencia, respaldo, continuidad entre dispositivos).

**Problema**: la información académica y personal está fragmentada (documentos, notas, calendario, LMS, mensajes), y el aprendizaje exige continuidad y contexto.

**Diferenciación**: integración semántica de capacidades (no una colección de herramientas sueltas). Threshold conecta documentos, notas, materias, evaluaciones, horarios y recordatorios dentro de un mismo contexto.

**Arquitectura**: local-first (filosofía), offline-first (consecuencia en experiencia). Backend es mecanismo de sync, no fuente de verdad de la UI.

**Usuario primario**: estudiantes universitarios con alta carga de información.

**Visión**: evolucionar desde herramienta universitaria hacia sistema personal de conocimiento que acompañe el aprendizaje continuo.

Para referencia completa de producto, marca y posicionamiento, ver `docs/ProductBrandFoundation.md` y `docs/BrandBrief.md`.

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

#### Logcat Reminder System
```powershell
# Captura en vivo de programación + entrega (día de clase, con Delivery Log ON en Developer Console)
adb logcat -c; adb logcat -s "ReactNativeJS" | Select-String -Pattern "\[DELIVERY\]|\[SCHEDULE\]|\[CANCEL\]|\[RECON\]|\[ENGINE\]|\[PIPELINE\]|\[REMINDER-DIAG\]|Reminder"

# Volcar buffer completo post-ejecución a archivo
adb logcat -d | Select-String -Pattern "\[DELIVERY\]|\[SCHEDULE\]|\[RECON\]|\[ENGINE\]|\[PIPELINE\]|\[REMINDER-DIAG\]|\[STRESS\]" > "C:\Users\cris7\OneDrive\Desktop\reminders_day.log"

# Tags del pipeline
# [DELIVERY]      — instante real de entrega en primer plano (id, título, receivedAt ISO)
# [SCHEDULE]      — provider agenda DATE trigger (id, scheduledAt ISO, now, delta)
# [CANCEL]        — provider cancela (id)
# [RECON]         — reconciler: SCHEDULE/CANCEL por diff vs plan
# [ENGINE]        — run del engine: entities/skipped; init/event stats
# [PIPELINE]      — decisión de Policy antes de reconciler/SO: policy, eventTime, baseTime, count, shouldCancel
# [STRESS]        — stress test del SO: attempted/scheduled/acceptedByOS/limitReachedAt
# [REMINDER-DIAG] — reporte completo del diagnóstico volcado a logcat (START/END)
# Nota: el reporte del diagnóstico también se muestra en pantalla (Developer Console).
# Los logs [Queue]/[PAYLOAD] de DatabaseService son las consultas SQL del diagnóstico;
# no representan el resultado — filtrar por los tags de arriba.
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

## Taxonomía de Tablas (oficial desde Sprint de Normalización Jul 2026)

No toda tabla merece sincronizarse. Cada tabla pertenece exactamente a una de estas categorías:

| Categoría | Descripción | Ejemplos |
|-----------|-------------|----------|
| **Entidad Sincronizable** | Cumple los 10 invariantes. Participa en Initial Sync, Delta Sync y Push. | `subjects`, `flashcards`, `ai_chats`, `assessment_files` |
| **Entidad Local** | Existe solo en el dispositivo. No tiene identidad global. | Cachés de UI, flags de sesión |
| **Infraestructura** | Soporte del protocolo. No representa datos del dominio. | `sync_queue`, `sync_journal`, `sync_debug_logs` |
| **Legacy / Pendiente de rediseño** | Tabla sin dueño claro, modelo incorrecto, o sin consumidores activos. Excluida del protocolo hasta rediseño formal. | `user_preferences` |

> **Regla**: La primera decisión al incorporar una tabla es clasificarla. Si no puede clasificarse con certeza como Entidad Sincronizable, no debe entrar al protocolo. La ambigüedad es una señal de diseño incompleto.

## Dos Patrones Oficiales de Entidad Sincronizable

**Standard Entity Pattern**: toda la información viaja por el Sync Protocol. Aplica a `subjects`, `courses`, `assessments`, `ai_chats`, `youtube_videos`, etc.

**Asset Entity Pattern**: la entidad se divide en (1) Metadata → Sync Protocol y (2) Binario (blob) → Asset Pipeline. El identificador remoto del blob (`cloud_url` o equivalente) sí viaja por el protocolo; la ruta local (`local_uri`) nunca.

**Asset Locality Invariant**: ningún dato específico del dispositivo puede sincronizarse (`local_uri`, rutas absolutas, cachés locales, permisos del SO). Véase `SYNC_ENTITY_SPEC.md` sección 4.

## Progress
### Done
- **[*NUEVO*] Reminder System v1.1 — semántica, engine, preferences, Settings y regresión CERRADO**: Cierre formal de la Fase S2 (Full Regression). `ReminderEngine.FullRegression.test.ts` ahora cubre la **matriz completa del dominio v1.1** con el pipeline wired (store → service → provider → engine → reconciler → OS) y el invariante `assertConverged` (OS EXACTAMENTE `computeCurrentPlan()`): **FSRS agregado diario** (N decks con due cards → exactamente N notificaciones, identidad `flashcard_deck::<id>::daily`, stagger +5min de `_resolveGroup`; deck con `card_count=0` → 0; checkTime configurable 08:00 → se agenda a esa hora; cambio de checkTime 19:00→08:00 → cancel + reschedule sin residuo ni duplicados; evento de mazo → resync → exactamente 1; due 5→0 → cancel; onEntityDeleted → cancel; action_completed → cancel; categoría deshabilitada → solo esa categoría a cero), **contrato de ancla de assessment** (exam→starts_at, deadline→due_at → 5 recordatorios cada uno; exam/deadline sin ancla → 0, sin fallback a `date`; cambio de ancla en runtime → reagenda la misma identidad con nuevos tiempos), **calendar_event** (timed → 2 recordatorios [−60, 0]; all-day → 0; cambio timed→all-day → OS converge a cero), y **matriz combinada** (2 clases + exam + deadline + sin-ancla + deck con due + deck vacío + timed + all-day → 15 notificaciones exactas; reinicio offline → estado reconstruido ≡ incremental). **Total suite: 28 tests en FullRegression / 34 suites / 466 PASS + 1 skip, typecheck limpio (0 errores), lint 0 errores.** Siguiente: **Sprint 3 — Feature Matrix (cierre de brechas funcionales)**.
- **[*NUEVO*] S1.5 — Assessment Domain Migration (granularidad temporal + anchor) — CERRADO**: Contrato del amendment implementado de punta a punta. **Migración v46** (`migrations.ts`): `ALTER TABLE assessments ADD COLUMN starts_at/ends_at/due_at/assessment_type` + backfill determinista SIN inventar medianoche (solo deriva `assessment_type` desde `type`: exam→exam, task→deadline; anchors temporales quedan NULL hasta que el usuario provea hora). **Dominio puro** `mobile/src/services/domain/assessmentTemporal.ts`: `resolveAssessmentAnchor` (exam→`starts_at`, deadline→`due_at`, otro→null — **el anchor lo decide el dominio, no ReminderPolicy**), `parseDatetimeOrNull` (rechaza date-only), `deriveAssessmentType`. Tipos ampliados (`Assessment` += 4 campos). Backend: `schema.js` (CREATE + `columns[]` para migrar DBs existentes) y `assessmentsController` (denormalize + create 19 columnas + update con pushes dinámicos que permiten null explícito). 24 tests nuevos (assessmentTemporal + migrations v46) → **PASS**. **Fixes de infraestructura del Convergence Test Framework (encontrados por el propio framework)**: (1) `TestEnvironment.start()` envuelto en `db.serialize()` — antes sqlite3 ejecutaba el DDL en paralelo y los INSERTs de seeds corrían ANTES de sus CREATEs (error latente preexistente `no such table: sync_version`); (2) tablas `grading_systems`/`grading_versions`/`assessment_results` + seeds (fallback id=3) añadidas — sin ellas `createAssessment` cortaba en "versión no encontrada" ANTES de `incrementSyncVersion` y el delta nunca veía las filas; (3) `DeviceSimulator._pull` ahora mapea la clave `flashcard_decks` del payload (bug preexistente: esperaba `flashcardDecks` camelCase, los mazos se descartaban → FK de cards fallaba). **Escenario 012** "Assessment temporal fields survive offline + sync" (examen+deadline offline → sync A/B/backend sin pérdida) → **12/12**. **Suite de convergencia completa: 28 escenarios / 195 assertions ALL PASSED**. Suite mobile: 65 suites / **700 PASS + 1 skip**, typecheck limpio, lint 0 errores. Siguiente: **S2 Reminder Engine** (AssessmentPolicy consume `resolveAssessmentAnchor`, `is_all_day` en eventos, `ReviewDueTrigger`, remover GradingPolicy/grading_period, ReviewPolicy con `checkTime`).
- **[*NUEVO*] Reminder System v1 CONGELADO + Settings UI + doc contract**: Cierre de documentación del subsistema. **`REMINDER_SYSTEM_V1_CONTRACT.md`** (docs/architecture) es la nueva fuente de verdad: pipeline (SQLite → SessionMerger → intents lógicos → ReminderPreferences → engine → reconciler → OS), invariante `OS === desired plan`, semánticas congeladas y contrato de tests. **Decisión de sincronización explícita**: `ReminderPreferences` es **DEVICE-LOCAL (MMKV)** — no tiene tabla SQLite, no participa en Initial/Delta/Push, no tiene `sync_version` ni endpoint backend (taxonomía: **Entidad Local**). Docs contradictorios marcados **SUPERSEDED**: `ReminderSettings-DesignBrief.md` (prescribía tabla `reminder_settings` sincronizable + perfiles + digest), `Reminder_Product_Spec.md` y `Reminder_Domain_Model.md` (perfiles/digest), `Reminder_Architecture.md` (exposición de perfiles, claves de prefs, digest), `NOTIFICATION_ARCHITECTURE.md` (pre-WIRING) y `audits/REMINDER_NOTIFICATION.md` (recomendaciones históricas). **Settings UI (Settings = intención/control, congelado)**: master switch + 5 categorías (toggle + offset por categoría, chip "Predeterminado" → `null`) + anticipación global + horario de silencio + reset + banner de permiso. **Sin** perfiles, sin "Recordatorios activos" (lectura cruda del OS **eliminada**), sin diagnóstico, sin IDs técnicos, sin botón de prueba — el diagnóstico queda solo en Developer Console (herramienta interna, no producto). FEATURE_MATRIX.md actualizado (§1.6 Reminder System v1 congelado + "Fuera de alcance v1"). Suite completa 63 suites/676 PASS + 1 skip (contrato legacy por fila física). Siguiente (inalterado): Full Regression, luego Sprint 3 (Feature Matrix — cierre de brechas funcionales).
- **[*NUEVO*] Reminder Full Regression E2E — 9 escenarios, extremo a extremo**: `ReminderEngine.FullRegression.test.ts` sobre el pipeline wired completo (store MMKV → service → provider → engine → reconciler → OS): (1) cold start OS vacío → plan exacto; (2) offline (delta + cambio de preferencias + cierre/reapertura sin red) → estado reconstruido ≡ incremental; (3) duplicados A,A,A → 1 notificación y reconciliación repetida sin churn; (4) offset 15→30 → **cancel + reschedule** del mismo id sin residuo ni duplicados; (5) categoría deshabilitada → solo esa categoría a cero; (6) master switch off → plan vacío y OS a cero; (7) quiet hours → omit (06:45 omitida, 08:45 programada); (8) reset → DEFAULT_PREFERENCES y OS reconvergen; (9) E2E resiliencia — edición cosmética offline + reinicios + 5 re-initialize → siempre 1 notificación, cero churn. Invariante por escenario: `assertConverged` — estado del OS EXACTAMENTE `computeCurrentPlan()`. 26 tests nuevos. Suite completa 63 suites/676 PASS, typecheck limpio, lint 0 errores en archivos tocados.
- **[*NUEVO*] Settings UI — superfície de Notificaciones v1 (Settings = intención/control)**: `PersonalizeRemindersModal` (master switch, 5 categorías con toggle + offset por categoría, chip "Predeterminado" → `offset: null`, anticipación global `defaultOffset`, horario de silencio, restaurar valores por defecto con confirmación) + banner de permiso del SO. **"Recordatorios activos" ELIMINADO** de Settings: leer el estado crudo del OS desde la UI de Settings era una superficie de diagnóstico disfrazada de producto (la reconfirmación del OS vive en Developer Console). "Próximos recordatorios" queda como decisión de producto futura (Agenda/Upcoming independiente de Settings), no como feature de Settings. Backend fuera de la ruta crítica.
- **[*NUEVO*] Reminder WIRING — el engine consume sesiones lógicas + preferencias (multiplicador CERRADO en producción)**: `ReminderEngine` recibe un 8º parámetro opcional `preferencesProvider` (opt-in: sin él, el legado por fila física se conserva intacto — 9 reminders por 3 filas duplicadas). Con provider, el pipeline de schedules pasa por `SchedulePlanBuilder.ts` (módulo puro): `mergeScheduleRows()` (SessionMerger, Fase 3) → LogicalSession + `ReminderPreferences` → **1 secuencia por sesión lógica** (identidad `schedule::logical::<key>`). 3 filas duplicadas de la misma clase → **1 notificación en el OS** (antes 9). Semánticas: `offset = getCategoryOffset('schedule')`; categoría disabled → 0 intents; `notificationsEnabled=false` → plan vacío completo (incluye otras entidades, master switch); quiet hours → OMIT (el `scheduledAt` caído en la ventana no nace, no se difiere); sesión no clasificable (sin dow/start) → sin secuencia; sesión con TODAS las filas `cancelled` → omitida (con ≥1 activa, activa). `initialize` ahora **rebuilds determinista**: limpia `desiredSequences` y `completedScheduleSessions` (el snapshot es la verdad; la memoria de "sesión completada" es efímera). Camino de eventos wired: `entity_changed`/`entity_deleted`/`action_completed` sobre schedule upsertan/remueven filas o marcan la sesión lógica completada y reconstruyen el grupo; eliminar 1 fila de N duplicadas conserva la sesión. Log `[PIPELINE] schedule::logical::<key> | policy=SchedulePlanBuilder | eventTime | offset | scheduledAt | outcome` (active/cancelled/expired/omitted/skipped). **Invariante de convergencia reforzada**: `getDesiredSequences()`, `_collectSequences()` y `computeCurrentPlan()` emiten el plan en **orden canónico determinista** (rank de ENTITY_TYPES + entityId) — el estado incremental (orden de llegada de eventos) y el estado reconstruido por snapshot convergen a orden idéntico (detectado por `DeltaSyncConvergence` Escenario B al activar el clear en `initialize`). `ReminderSys...: `ReminderEngine` recibe un 8º parámetro opcional `preferencesProvider` (opt-in: sin él, el legado por fila física se conserva intacto — 9 reminders por 3 filas duplicadas). Con provider, el pipeline de schedules pasa por `SchedulePlanBuilder.ts` (módulo puro): `mergeScheduleRows()` (SessionMerger, Fase 3) → LogicalSession + `ReminderPreferences` → **1 secuencia por sesión lógica** (identidad `schedule::logical::<key>`). 3 filas duplicadas de la misma clase → **1 notificación en el OS** (antes 9). Semánticas: `offset = getCategoryOffset('schedule')`; categoría disabled → 0 intents; `notificationsEnabled=false` → plan vacío completo (incluye otras entidades, master switch); quiet hours → OMIT (el `scheduledAt` caído en la ventana no nace, no se difiere); sesión no clasificable (sin dow/start) → sin secuencia; sesión con TODAS las filas `cancelled` → omitida (con ≥1 activa, activa). `initialize` ahora **rebuilds determinista**: limpia `desiredSequences` y `completedScheduleSessions` (el snapshot es la verdad; la memoria de "sesión completada" es efímera). Camino de eventos wired: `entity_changed`/`entity_deleted`/`action_completed` sobre schedule upsertan/remueven filas o marcan la sesión lógica completada y reconstruyen el grupo; eliminar 1 fila de N duplicadas conserva la sesión. Log `[PIPELINE] schedule::logical::<key> | policy=SchedulePlanBuilder | eventTime | offset | scheduledAt | outcome` (active/cancelled/expired/omitted/skipped). **Invariante de convergencia reforzada**: `getDesiredSequences()`, `_collectSequences()` y `computeCurrentPlan()` emiten el plan en **orden canónico determinista** (rank de ENTITY_TYPES + entityId) — el estado incremental (orden de llegada de eventos) y el estado reconstruido por snapshot convergen a orden idéntico (detectado por `DeltaSyncConvergence` Escenario B al activar el clear en `initialize`). `ReminderSystemFactory` inyecta el provider de producción (`getReminderPreferencesService().get`, MMKV lazy, nunca lanza). NotificationReconciler y SequenceFactory NO se tocaron. Fronteras sin cambiar: `ReminderEngine.configure()` NO existe (el provider se pasa por constructor); deeplink de sesión lógica no resalta la fila física (follow-up de UI). 12 tests nuevos en `ReminderEngine.Wiring.test.ts`. Suite completa 32 suites/422 tests (421 PASS + 1 skip = contrato legacy), regression 10/10 PASS, typecheck limpio, lint 0 errores en archivos tocados (10 preexistentes ajenos). Siguiente: Settings UI (ajustar offset/categorías/quiet hours) → Full Regression.
- **[*NUEVO*] ReminderPreferences — contrato congelado + service + defaults centralizados (sin wiring)**: `ReminderPreferences.ts` (módulo puro: tipos, `DEFAULT_PREFERENCES`, `parseReminderPreferences`, `mergePreferences`, `getCategoryOffset`, `isCategoryEnabled`, `isInQuietHours`) + `ReminderPreferencesService.ts` (IO: `get()` / `set(patch)` / `reset()` / `defaults` sobre MMKV device-local). Contrato: `notificationsEnabled`, `defaultOffset`, `categories {assessment, schedule, calendar_event, flashcard_deck, grading_period}` (exactamente las 5 entidades del engine; "Tareas" NO es categoría de dominio hasta resolver su correspondencia con assessment/submit_work — no se inventa entidad por la UI) y `quietHours {enabled, start, end}`. Semánticas congeladas: `category.offset ?? defaultOffset`; un solo offset por categoría; máximo 1 reminder por evento lógico; perfiles minimal/standard/persistent/custom quedan INTERNOS al engine (`ReminderProfile`, sin exponerse); `notificationsEnabled=false` → no se genera plan; categoría `enabled=false` → sin reminders de esa categoría; quiet hours → OMIT, no defer; backend fuera de la ruta crítica. Defaults explícitos y centralizados: `defaultOffset=15`, assessment/grading_period `offset=1440` como excepción explícita por categoría, schedule/calendar_event/flashcard_deck `offset=null` (heredan el global), quietHours off `22:30–07:00`. Fallback por campo ante corrupción (JSON inválido), valores imposibles (offset negativo/no-entero/>7 días, booleano no-booleano, hora no HH:MM), schema viejo (claves desconocidas ignoradas) y ausencia de datos — NUNCA bloquea el arranque (store que lanza → defaults). `parse(absence) === DEFAULT_PREFERENCES` y `parse(DEFAULT) === DEFAULT`. **Semántica de offset ENMENDADA (Ago 2026, consumidor real = Settings UI)**: `offset: number | null`; `null` = "usar predeterminado" → hereda `defaultOffset` global; número = offset explícito que gana al global. `parse` PRESERVA `null` y normaliza a `null` un offset ausente/inválido en una categoría PRESENTE; solo la ausencia TOTAL de datos vuelve a `DEFAULT_PREFERENCES` (con sus excepciones 1440). Los 15/1440 son defaults iniciales, no fallback estructural. Antes, un offset ausente se rellenaba con el default de categoría y el global quedaba inerte (contradicción con `getCategoryOffset` — corregida). 23 tests nuevos (defaults, round-trip, actualización parcial, reset, corrupción, schema viejo con "task" ignorada, valores inválidos, quiet hours con wrap de medianoche, store que lanza). Suite completa 31 suites/409 tests (408 PASS + 1 skip = contrato engine congelado hasta wiring). Typecheck limpio, lint 0 errores. **Consumido por el WIRING (entrada superior).**
- **[*NUEVO*] Fase 3 (Session Merger) — contrato congelado + módulo puro**: `SessionMerger.ts` establece la IDENTIDAD LÓGICA de las sesiones académicas a partir de filas físicas de `schedules`. Clave de identidad congelada: `subject_id | day_of_week (7→0) | start_time | end_time | name` (normalizada). Atributos que NO distinguen sesiones y NO forman parte de la identidad: `color` (cosmético) y `status` (estado de la fila). Regla no-destructiva: filas que difieren en `end_time` (duración distinta) o `name` (p.ej. Teoría vs Laboratorio) NUNCA se fusionan — son sesiones legítimas distintas. Filas sin `day_of_week` o sin `start_time` → sesiones singleton no clasificables (nada se pierde; ClassPolicy no les genera secuencia de todos modos). Salida determinística e independiente del orden de entrada; id de sesión estable (`logical::<key>`); `sourceScheduleIds` conserva TODAS las filas absorbidas (diagnóstico/trazabilidad, nunca multiplicador de reminders). Evidencia: 3 filas duplicadas de la misma clase lógica → exactamente 1 sesión lógica (frontera físico→lógico; NO se tocó NotificationReconciler ni SequenceFactory — la regla de Fase 0 se mantiene). 13 tests nuevos: A,A,A→[A], A,B,A→[A,B] (independiente del orden), anti-destructivo end_time/name → [A,B], color/status no discriminan → [A], normalización dow 7→0, singleton no clasificables, determinismo deep-equal, no-loss (unión de sourceScheduleIds = ids de entrada), id estable, entrada vacía. Suite completa 30 suites/386 tests (385 PASS + 1 skip = contrato engine congelado hasta el wiring). Typecheck limpio, lint 0 errores en archivos nuevos. Siguiente (inalterado): ReminderPreferences → WIRING (el engine consume sesiones lógicas) → Settings UI → Full Regression.
- **[*NUEVO*] Fase 0 (Reminder) — Convergencia del reconciler blindada + auditoría de duplicados de schedules**: 
  - Tests de convergencia determinística (`ReminderEngine.ConvergenceDuplicates.test.ts`): (1) `initialize+reconcile x3` con 3 filas duplicadas de la misma clase lógica → estado idéntico y **cero churn** (`cancelled=0`; el reconciler no cancela ni re-agenda planes idénticos — contra los MISS/ORPHAN del diagnóstico real); (2) independencia del orden de filas → estado idéntico; (3) duplicados con orden mezclado → mismo conjunto de intents (ids) y mismo multiset de tiempos (la asignación de colisiones +5min de `_resolveGroup` puede rotar entre ids idénticos, pero los conjuntos son iguales).
  - **Evidencia del multiplicador**: con 3 filas físicas de la misma clase lógica (subject+dow+start) el engine produce **9 reminders en el OS** (3 filas x 3 offsets del perfil standard `[-30,-5,0]`). La identidad de secuencia es por fila física (`schedule::<id>`), no por intent lógico → cada duplicado aporta su propia secuencia. Contrato objetivo congelado como `it.skip` (1 intent lógico → 1 recordatorio por offset) para habilitar cuando la identidad del engine sea por intent lógico (Session Merger).
  - Auditoría pura en `ReminderDiagnosticsCore.ts`: `logicalScheduleKey()` (subject|dow|start), `auditSchedules()` (physical/logical/duplicate/unclassifiable rows + grupos), `buildLayerTrace()` (intents lógicos, desired engine vs OS, `dataMultiplier` = filas físicas / clases lógicas, `offsetsPerScheduleRow`, convergencia del reconciler, status `clean|duplicates|drift`). `formatReminderDiagnostics()` ahora imprime **Schedules Audit** y **Layer trace** → el diagnóstico de la Developer Console evidencia el multiplicador en vivo (`dataMultiplier > 1` → filas duplicadas, cada una genera su propia secuencia).
  - 15 tests nuevos (5 convergencia [4 PASS + 1 skip contrato], 10 auditoría/traza/reporte). Suite completa 29 suites/373 tests (372 PASS + 1 skip), typecheck limpio, lint 0 errores en archivos tocados. Sin cambios de comportamiento: solo observabilidad + tests (regla: no tocar lógica de dominio hasta tener evidencia).
  - Siguiente (inalterado): Fase 3 (Session Merger para bloques contiguos), luego Fase 4 (rediseño Study Session).
- **[*NUEVO*] Date-only parsing corregido (contrato centralizado)**: `parseReminderDate()` en `mobile/src/services/reminders/date/parseReminderDate.ts` ahora interpreta `YYYY-MM-DD` como **fecha calendario local** (`new Date(year, month-1, day)` → 00:00 local), no como `new Date('YYYY-MM-DD')` (00:00 UTC → día anterior a las 19:00 en UTC−5). Hallazgo concreto: con un assessment pendiente `date=2026-07-22` en Colombia, el reminder se anclaba al 2026-07-21 19:00; hoy está oculto porque los assessments del dispositivo están `done=1` (no generan secuencia). Mismo contrato que `DD-MM-YYYY` (ya usaba medianoche local). Los timestamps con hora (`2026-07-10T15:00:00Z`) se preservan como instante absoluto. Regresiones: `2026-07-22`/`2026-01-01`/`2026-12-31` → 00:00 local; reproducción exacta del bug en `parseReminderDate.timezone.test.ts` con `TZ=America/Bogota` (afirma `2026-07-22T05:00:00.000Z`, NO `2026-07-21T19:00:00.000Z`); DD-MM-YYYY produce exactamente el mismo resultado (medianoche local). Suite completa 28 suites/360 tests PASS, regression 10/10 PASS, typecheck limpio, lint 0 errores en archivos tocados (10 errores preexistentes ajenos). Nada más del Reminder Engine modificado. Siguiente (inalterado): Fase 3 (Session Merger para bloques contiguos), luego Fase 4 (rediseño Study Session).
- **[*NUEVO*] Fase 2 (Reminder) — validación de campo CERRADA: entrega exacta en Doze**: `AlarmManager.canScheduleExactAlarms()` autoritativo integrado vía módulo nativo local `mobile/modules/threshold-exact-alarm/` (llama a `AlarmManager.canScheduleExactAlarms()`, no a `checkSelfPermission` — falso negativo en MIUI; import lazy + try/catch → null si el módulo falta). Concesión vía CTA `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` + reverificación on-focus (`AppState 'active'` en `app/developer.tsx`) + resync en transición false→true. Evidencia en Redmi Note 12 Pro+ 5G (MIUI V816, SDK 34, America/Bogota): `scheduledAt 16:00:00 → receivedAt 16:00:00.045 → Δ=45 ms`. Bug de drift de alarmas inexactas (+8/+11 min) cerrado. Cadena validada: Engine → Reconciler → AlarmManager → Doze → entrega exacta. Countdown: corregido. Schedule sync: convergencia 1:1 validada. Warning `shouldShowAlert is deprecated` → deuda técnica de Expo SDK 54 (separado).
- **[*NUEVO*] Regresión de duplicación de schedules CERRADA con evidencia de campo**: ciclo completo en dispositivo (dispositivo real + backend Render) — (1) crear schedule dow4 20:00 → SQLite 1 fila, (2) POST → backend 1 fila (mismo ID `d87118d3`, total 20), (3) pull → sigue 1 fila sin duplicados (el fix `id` en POST elimina el doble UUID), (4) editar vía delete+create (patrón de la app en `SchedulePlannerModal`) → vieja soft-deleted + nueva `regression-edit-01`, backend 1 fila, (5) eliminar → backend 19 total / 0 test rows, (6) pull → no reaparece (tombstones aplicados). Estado final: 19 activos locales = 19 backend, 0 duplicados por celda. El bug de duplicación queda cerrado.
- **[*NUEVO*] Countdown del Dashboard reactivo**: `upNextClass` en `app/(tabs)/index.tsx` calculaba `new Date()` una sola vez dentro de `useMemo` (deps `[storeSchedules, subjectNamesMap, t]`), sin fuente de tiempo reactiva → "Dentro de Xh Ym" quedaba congelado al montar. Fix: estado `nowTimestamp` (inicializado con `Date.now()`) actualizado por `setInterval` de 30s + limpieza en unmount, y `new Date(nowTimestamp)` como entrada del `useMemo` con `nowTimestamp` en deps. Typecheck limpio, lint 0 errores.
- **[*NUEVO*] Log `[PIPELINE]` en ReminderEngine**: `_buildDesiredSequence` ahora emite una línea por entidad que concentra toda la decisión de Policy ANTES de que intervengan reconciler y SO: `[PIPELINE] <type>::<id> | policy=<ClassName> | eventTime=<local YYYY-MM-DDTHH:mm> | baseTime=<local> | sequence=N reminders | shouldCancel=true/false`. Se emite en los 3 outcomes (active / cancelled / expired). Permite discernir si un caso extraño nació en la Policy o aguas abajo (reconciler/SO). Suite completa 27 suites/342 tests PASS, typecheck limpio.
- **[*NUEVO*] F14 — Schema Postgres de `scanned_documents` reparado**: El bloque en `backend/database/schema.js` estaba malformado (duplicados `user_id`/`subject_id`, columna `duration` ajena, segundo `postgres:` anidado que sobrescribía al real). El DDL Postgres real carecía de `updated_at` → error de sync `column "updated_at" of relation "scanned_documents" does not exist`. Fix: bloque reescrito con columnas de protocolo completas (`updated_at`, `sync_version`, `deleted_at`, `version_number`, `last_modified_by`, `mime_type`, `extracted_at`), array `columns` ampliado para que `migrateColumnsPostgres`/`migrateColumnsSqlite` las agreguen vía `ALTER TABLE` en DBs existentes, y `audio_recordings` extraído como entrada top-level propia (antes solo existía anidado en el bloque de `scanned_documents`).
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
- **[*NUEVO*] Reminder Diagnostics — Developer Console**: sección "Reminders" en `app/developer.tsx` con 3 botones (Reminders Diagnóstico, Recomputar Plan, Delivery Log ON/OFF). `ReminderDiagnosticsCore.ts` puro (computeDiff: aligned/drifted/missing/orphan + formateo) + `ReminderDiagnostics.ts` IO (timezone, filas crudas, plan recomputado desde DB, agendado en SO). `ReminderEngine.computeCurrentPlan(snapshot?)` read-only. 9 tests nuevos — suite completa 25 suites/303 tests PASS, typecheck + lint limpios.
- **[*FIX*] Reminder Fase 0 — Cap global de 3 notificaciones eliminado**: `InterruptionPolicy._applySimultaneousLimit` hacía `slice(0,3)` sobre el plan completo (bug de arquitectura R1, detectado con el diagnóstico real). El plan se truncaba a las 3 notificaciones más cercanas a `now`, cancelando silenciosamente todo lo demás en cada run → churn de ORPHAN/MISS, recordatorios "aleatorios" que aparecen/desaparecen. El límite por grupo en `_resolveGroup` se conserva (correcto: prioridad dentro de la misma ventana de colisión); solo se eliminó el truncado global. 3 tests nuevos (plan de 200 reminders sobrevive intacto). Suite completa 25 suites/309 tests PASS, typecheck limpio. Siguiente: Fase 1 (Session Merger para bloques contiguos).
- **[*NUEVO*] Reminder Fase 1 — Parseo centralizado de fechas**: `parseReminderDate()` en `mobile/src/services/reminders/date/parseReminderDate.ts` como ÚNICA puerta de entrada de fechas del Reminder Engine. Soporta ISO (`2026-07-22`, `2026-07-10T15:00:00Z`) y DD-MM-YYYY con `/` o `-` (`09-07-2026` → 9 de julio, día primero), valida rangos reales (mes 1-12, día válido, `29-02-2026` no bisiesto → null), devuelve `Date | null`, nunca lanza, nunca delega el formato ambiguo día/mes a `new Date(string)` (que lo parsearía como MM-DD-YYYY). Aplicado en `EventPolicy` (getEventTime/getExpiration), `AssessmentPolicy` y `GradingPolicy` — elimina el bug R6/H1 (calendar_events con `09-07-2026` → NaN). `ClassPolicy` no se tocó (usa `day_of_week` + `start_time`, no parsea fechas completas). Fechas inválidas ahora devuelven null en vez de Invalid Date. 12 tests del helper + 3 de regresión DD-MM-YYYY en EventPolicy. Suite completa 26 suites/321 tests PASS, regression 10/10 PASS, typecheck + lint limpios. Siguiente: Fase 2 (activar `shouldCancel`), luego Fase 3 (Session Merger para bloques contiguos).
- **[*FIX*] Reminder Fase 2 — `shouldCancel` activado + ancla temporal determinista para repasos**: Causa raíz de los 3 MISS `flashcard_deck` del diagnóstico real: `ReviewPolicy` no implementaba `getEventTime` → `SequenceFactory` usaba `baseTime = eventTime ?? now` (repaso anclado al instante T0 de construcción) → `InterruptionPolicy._collect` descartaba `scheduledAt < now` un instante después → el deck nunca llegaba al reconciler/SO. `computeCurrentPlan(snapshot)` no lo mostraba porque reconstruye con `now` fresco. Fix: (1) `ReviewPolicy.getEventTime()` implementado con bloques deterministas de ventana de estudio — dentro 08:00–21:00 → siguiente hora en punto (10:07→11:00, 11:43→12:00, 20:15→21:00); <08:00 → hoy 08:00; ≥21:00 → mañana 08:00 (22:30→mañana 08:00). Cuando exista Session Merger, anclar a la próxima sesión de estudio en vez del bloque horario. (2) `ReminderEngine._buildDesiredSequence` ahora invoca `policy.shouldCancel(seq, entity)` → null (antes solo existía en tests). (3) `shouldCancel`/`shouldCancelReminder` usan `card_count ?? dueCardsCount` — 2 de 3 mazos de la corrida tenían `card_count=0` (mazo vacío ya no programa recordatorios). 14 tests nuevos (getEventTime con límites 08:00→09:00 y 21:00→mañana 08:00, determinismo; deber-cancel por `card_count`; deck con cards>0 agendado al próximo bloque, deck vacío sin secuencia). Suite completa 26 suites/335 tests PASS, regression 10/10 PASS, typecheck limpio, lint 0 errores (6 warnings preexistentes). Siguiente: Fase 3 (Session Merger para bloques contiguos), luego Fase 4 (rediseño Study Session).
- **[*NUEVO*] Regresión permanente con snapshot real del dispositivo**: `ReminderEngine.RealSnapshot.FlashcardRegression.test.ts` — reproduce literalmente el escenario que produjo los 3 MISS `flashcard_deck` del diagnóstico real (2026-08-07, tz=America/Bogota): decks `33f67627-48e7-4f38-af0a-3820408d53bc` (cards=10, "Expo"), `c7aa6323-94bd-4aac-a30b-5d558a6b409d` (cards=0) y `817d5cbe-e417-4c41-af2f-83a484130df1` (cards=0), con `now=10:03:22` local. Afirma la transición completa del pipeline por deck: `shouldCancel` (cards>0 → false; cards=0 → true), `getEventTime` (10:03 → 11:00), `scheduledAt` en el bloque exacto (nunca en `now`), presencia en el plan (`computeCurrentPlan` read-only) y ausencia de churn en re-initialize. Corrobora en vivo lo que el logcat mostró: `[SCHEDULE] flashcard_deck::33f67627::0 | scheduledAt=2026-08-07T16:00:00Z` (11:00 local) tras el fix. 7 tests nuevos — suite completa 27 suites/342 tests PASS, typecheck limpio, lint 0 errores. Protege ReviewPolicy/SequenceFactory/InterruptionPolicy contra reintroducción del defecto. Comando: `npx jest --testPathPattern "RealSnapshot.FlashcardRegression"`.
- **[*NUEVO*] Sprint de Normalización Sync v1.0 — CERRADO (Jul 2026)**:
  - **Auditoría de cobertura**: 4 entidades identificadas como incompletas (youtube_videos, ai_chats, user_preferences, assessment_files).
  - **`youtube_videos`** integrada al protocolo: Migration V32, `YouTubeSynchronizer`, Initial + Delta Sync, enqueueLegacyUnsyncedData.
  - **`ai_chats`** integrada al protocolo: `aiChatsController.js`, rutas dedicadas, `AiChatSynchronizer`, Initial + Delta Sync, enqueueLegacyUnsyncedData. Patrón append-only, orden por `created_at`.
  - **`user_preferences`** reclasificada como **Legacy / Pendiente de rediseño**: PK incorrecta (`key` sin `user_id`), tabla sin consumidores activos. Excluida del protocolo. No integrar hasta rediseño formal del modelo K/V.
  - **`assessment_files`** integrada al protocolo (**Asset Entity Pattern**): `assessmentFilesController.js` con version guards, `AssessmentFileSynchronizer` con omisión explícita de `local_uri`, Initial + Delta Sync con JOIN correcto (assessment_files → assessments → subjects → user_id).
  - **Taxonomía de Tablas formalizada**: 4 categorías oficiales (Sincronizable, Local, Infraestructura, Legacy/Rediseño). Gobernada en `SYNC_ENTITY_SPEC.md`.
  - **Asset Locality Invariant documentado**: ningún dato específico del dispositivo puede sincronizarse. Aplica a backend (controller) y cliente (synchronizer). Invariante válido independientemente del proveedor de almacenamiento.
  - **`SYNC_ENTITY_SPEC.md` actualizado a v1.1**: Taxonomía, dos patrones oficiales (Standard / Asset), Asset Locality Invariant, glosario ampliado, registro actualizado a 21 entidades + tabla de entidades no sincronizables.

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
- `npm run test:ci` — Suite completa del Reminder System (303 tests, 25 suites)
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

### Reminder Diagnostics — Diagnóstico con datos reales (Ago 2026)
- **Regla**: un desfase de notificaciones no se arregla hasta que se observa con datos reales. Diagnóstico primero, fix después (mismo espíritu que "si no puedes observar una sincronización, no puedes confiar en ella").
- **Developer Console → sección Reminders** (`app/developer.tsx` + `DeveloperService.ts`): tres botones.
  - **Reminders Diagnóstico** → `collectReminderDiagnostics()`: recolecta timezone del dispositivo (`Intl.DateTimeFormat` + offset), filas crudas de schedules/assessments/calendar_events/decks tal como están en SQLite, el **plan esperado** recomputado desde la DB actual, lo **agendado en el SO** (`getAllScheduledNotificationsAsync`), y un **diff** por reminder.
  - **Recomputar Plan** → `coordinator.resync()` + re-diagnóstico.
  - **Delivery Log ON/OFF** → logger en primer plano que emite `[DELIVERY]` con el instante real de entrega (id, título, receivedAt ISO).
- **Diff por reminder** (`ReminderDiagnosticsCore.computeDiff`): `aligned` (Δ ≤ 5s), `drifted` (trigger SO ≠ plan), `missing` (el plan espera algo que el SO no tiene → el engine nunca corrió cerca del evento o el offset ya pasó), `orphan` (notificación en SO sin contraparte en el plan).
- **Purity**: `ReminderDiagnosticsCore.ts` es 100% puro (tipos + `computeDiff` + formateo, testeable sin expo). `ReminderDiagnostics.ts` solo hace IO (repos + engine + expo-notifications). El test `ReminderDiagnostics.test.ts` importa solo el Core.
- **`ReminderEngine.computeCurrentPlan(snapshot?)`** es read-only: recomputa el plan desde un snapshot sin tocar el provider ni el estado del engine (sin efectos sobre el SO).
- **Prueba de stress SO [Ago 2026]**: `runOSStressTest(150)` en dispositivo → `attempted=150 scheduled=150 acceptedByOS=150 limitReachedAt=none`. Android + expo-notifications acepta al menos 150 one-shots programadas sin límite práctico. **Implicación**: el `slice(0,3)` eliminado en Fase 0 no protegía ningún límite del SO — era solo una restricción artificial del engine. La ventana de planificación (30/60 días o todas las ocurrencias) se decide por **UX**, no por infraestructura. Los problemas restantes son de **dominio** (Session Merger, Study Session, parseDate, shouldCancel, perfiles, dueCardsCount, ReviewPolicy), no de plataforma.
- **Uso**: captura día de clase 6–8 con Delivery Log ON, correlacionar `[SCHEDULE] scheduledAt`, trigger `OS` del reporte, `[DELIVERY] receivedAt` y filas `start/end` de schedules. El reporte completo se vuelca a logcat con `[REMINDER-DIAG] START/END` y también se muestra en pantalla. Un `[DRIFT]` apunta a timezone; un `[MISS]` apunta a falta de re-agendamiento en background; `raw.schedules` de 1 h confirma el doble aviso por bloque.

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
- **Bridge JSI de expo-sqlite ~8x más lento en cold start**: consultas que en warmup toman ~31ms toman ~2450ms (bridge=1822ms) durante los primeros segundos del arranque. El patrón es consistente (Schedules: 627ms, GPA: 628ms). No es SQL ni JS — es el runtime nativo que aún no estabilizó su pipeline. Mitigación posible: mover consultas grandes fuera de la ventana crítica post-mount o diferirlas a un microtask tras el primer frame renderizado. Investigar si es contención con el hilo de React Native durante el primer render, cold start del native thread pool de expo-sqlite, o scheduler interno de Hermes.

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
- `backend/controllers/aiChatsController.js` — incrementSyncVersion + recordDeletion (ai_chats) 🆕
- `backend/controllers/assessmentFilesController.js` — CRUD con version guards, omite local_uri, `AssessmentFileSynchronizer` 🆕

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

### Reminder System (Diagnóstico)
- `mobile/src/services/reminders/SchedulePlanBuilder.ts` — **WIRING**: módulo puro que convierte filas de schedules + ReminderPreferences en 1 secuencia por sesión lógica (SessionMerger → offset → quiet hours → status → SequenceFactory). `buildScheduleSequences()` / `buildSessionSequence()` con hook de log opcional.
- `mobile/src/services/reminders/ReminderPreferencesService.ts` — IO MMKV device-local (`get`/`set`/`reset`), NUNCA lanza; consumido por la fábrica vía `getReminderPreferencesService().get` (WIRING).
- `mobile/src/services/reminders/ReminderPreferences.ts` — Contrato congelado de preferencias (DEFAULT_PREFERENCES, parse/merge, getCategoryOffset, isCategoryEnabled, isInQuietHours).
- `mobile/src/services/reminders/ReminderSystemFactory.ts` — Composition root; inyecta el preferencesProvider de producción en `ReminderEngine`.
- `mobile/src/services/reminders/__tests__/ReminderEngine.Wiring.test.ts` — 12 tests del pipeline wired (multiplicador cerrado, offsets, categorías, master switch, quiet hours, eventos, no-classifiable, canceladas, determinismo).
- `mobile/src/services/reminders/ReminderDiagnosticsCore.ts` — Núcleo puro: tipos + `computeDiff` (aligned/drifted/missing/orphan) + `formatDiffReport` + `formatReminderDiagnostics`
- `mobile/src/services/reminders/date/parseReminderDate.ts` — Única puerta de entrada de fechas del Reminder Engine: ISO + DD-MM-YYYY, valida rangos, `Date | null`, nunca lanza
- `mobile/src/services/reminders/__tests__/date/parseReminderDate.test.ts` — 11 tests del helper (ISO, DD-MM-YYYY, inválidas, vacío, null)
- `mobile/src/services/reminders/ReminderDiagnostics.ts` — IO: `collectReminderDiagnostics()` (timezone, filas crudas, plan recomputado, agendado SO), delivery logger `[DELIVERY]` ON/OFF, **OS stress test** (`runOSStressTest(count)` / `clearOSStressTest()`): programa N notificaciones sintéticas `stress-*` y reporta cuántas acepta realmente el SO (`acceptedByOS` vs `attempted`) para detectar límites del proveedor (Android no impone techo práctico en one-shots, pero debe verificarse por fabricante).
- `mobile/src/services/reminders/ReminderEngine.ts` — `computeCurrentPlan(snapshot?)` read-only (plan enriquecido sin efectos sobre el SO)
- `mobile/src/services/reminders/__tests__/ReminderDiagnostics.test.ts` — 9 tests del Core puro
- `mobile/src/services/developer/DeveloperService.ts` — `runReminderDiagnostics()` / `resyncReminders()` / `toggleReminderDeliveryLogging()` / `runOSStressTest()` / `clearOSStressTest()`
- `app/developer.tsx` — sección "Reminders" de la Developer Console (5 botones: Diagnóstico, Recomputar Plan, Delivery Log, Stress SO 150, Limpiar Stress + reporte monospace)

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
