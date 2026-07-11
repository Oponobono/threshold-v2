# Sync Entity Specification v1.1

> **Propósito**: Definir formalmente qué significa ser una entidad sincronizable en el Sync Engine de Threshold.
> Este documento describe el **contrato**, no la implementación. Debe sobrevivir a cambios de base de datos,
> framework o lenguaje.
>
> Documento relacionado: [`SYNC_PROTOCOL.md`](./SYNC_PROTOCOL.md) — describe el protocolo de sincronización
> (eventos, flujos, endpoints, conflicto, borrado).
>
> **v1.1 — Sprint de Normalización**: Formaliza la Taxonomía de Tablas, los dos Patrones Oficiales de Entidad
> (Standard y Asset), el Asset Locality Invariant, y actualiza el registro a 21 entidades.

---

## 1. Taxonomía de Tablas

No toda tabla merece sincronizarse. La primera decisión al incorporar una tabla es clasificarla.
Esta clasificación **no es reversible sin justificación explícita**.

| Categoría | Descripción | Ejemplos |
|-----------|-------------|----------|
| **Entidad Sincronizable** | Cumple los 10 invariantes. Participa en Initial Sync, Delta Sync y Push. | `subjects`, `flashcards`, `ai_chats`, `assessment_files` |
| **Entidad Local** | Existe solo en el dispositivo. No tiene identidad global. | Cachés de UI, flags de sesión |
| **Infraestructura** | Soporte del protocolo. No representa datos del dominio. | `sync_queue`, `sync_journal`, `sync_debug_logs` |
| **Legacy / Pendiente de rediseño** | Tabla sin dueño claro, modelo incorrecto, o sin consumidores activos. Excluida del protocolo hasta rediseño formal. | `user_preferences` |

> **Regla**: Si una tabla no puede clasificarse con certeza en la primera fila, no debe entrar al protocolo.
> La ambigüedad en la clasificación es una señal de diseño incompleto, no un caso especial a resolver con código.

---

## 2. Definiciones

### Entidad persistente
Existe en la base de datos. No necesariamente participa en sincronización.
Ejemplos: logs de auditoría, cachés de analytics, configuraciones efímeras.

### Entidad sincronizable (SyncEntity)
Cumple **todos** los invariantes del protocolo (sección 3). Es una ciudadana de primera clase del Sync Engine.
Su estado debe converger en todos los dispositivos que pertenecen al mismo usuario tras cada ciclo de sync.

### Dependencia
Una entidad sincronizable puede depender de otra para existir. Ejemplo: `audio-transcript` depende de
`audio-recording` (FK vía `recording_id`). La entidad padre debe sincronizarse antes que la hija.

### Asset entity
Una entidad sincronizable que además posee un archivo binario (foto, audio, documento) manejado por el
Asset Pipeline. El metadata (JSON) sigue el protocolo estándar; el blob sigue un pipeline paralelo
(upload/download con checksums, reintentos, LRU eviction).

---

## 3. Invariantes del Protocolo (Sync Entity Contract)

Estas 10 reglas no son negociables. Si una tabla no cumple una, **no es una entidad sincronizable**.

| # | Invariante | Descripción |
|---|------------|-------------|
| 1 | `user_id` | Toda SyncEntity posee una columna `user_id` que la vincula al propietario |
| 2 | `sync_version` | Toda SyncEntity posee una columna `sync_version` que refleja la última mutación global |
| 3 | Mutación incrementa `sync_version` | Todo CREATE/UPDATE debe incrementar el contador global `sync_version` y asignarlo a la fila |
| 4 | Deletion genera `deletion_version` | Todo DELETE registra `(entity_type, entity_id, user_id, deletion_version)` en `sync_deletions` |
| 5 | Initial Sync | La entidad aparece en el payload de `GET /api/sync/initial` |
| 6 | Delta Sync | La entidad aparece en `GET /api/sync/delta` vía `WHERE user_id = ? AND sync_version > ?` |
| 7 | Push | Existe un endpoint CREATE + UPDATE + DELETE en backend, y el móvil puede encolarlos en `sync_queue` |
| 8 | Backup/Restore | La entidad se incluye en el backup (cuando aplica — asset entities tienen pipeline adicional) |
| 9 | Consistency Report | La entidad aparece en el reporte post-suite que compara backend vs dispositivos |
| 10 | Cobertura de pruebas | La entidad tiene un escenario de convergencia dedicado o está cubierta por la Stress Suite |

*Si una tabla rompe cualquiera de estas reglas, no es una entidad sincronizable. Es solo una tabla.*

La incorporación de una nueva SyncEntity no se considera completa hasta que todos los invariantes
sean verificables mediante pruebas automáticas (Convergence Suite, Stress Suite, Consistency Report).

---

## 4. Los Dos Patrones Oficiales de Entidad

Toda SyncEntity se implementa siguiendo **exactamente uno** de estos dos patrones.

### Patrón A — Standard Entity Pattern

Toda la información de la entidad viaja por el protocolo de sincronización.
No existen campos específicos del dispositivo ni artefactos binarios.

**Aplica a:** `subjects`, `courses`, `assessments`, `flashcard_decks`, `flashcards`, `calendar_events`,
`schedules`, `study_sessions`, `grading_periods`, `lms_accounts`, `subject_threshold_overrides`,
`ai_chats`, `youtube_videos`, `audio_transcripts`, `youtube_transcripts`.

```
Cliente → sync_queue → PUT /api/{entity}/:id → incrementSyncVersion() → Delta Sync → todos los dispositivos
```

### Patrón B — Asset Entity Pattern

La entidad se divide en **dos responsabilidades arquitectónicas distintas**:

| Responsabilidad | Propietario | Qué viaja |
|----------------|------------|----------|
| **Metadata** | Sync Protocol | `id`, `user_id`, `file_name`, `file_type`, `file_size`, identificador remoto del blob | 
| **Binario (Blob)** | Asset Pipeline | El archivo físico (PDF, JPG, MP3) |

**Aplica a:** `photos`, `audio_recordings`, `scanned_documents`, `assessment_files`.

```
Metadata:  Cliente → sync_queue → PUT /api/{entity}/:id → Delta Sync (JSON only)
Binario:   Cliente → Upload Queue → Uploadthing/Storage Provider → cloud_url
```

#### Identificador remoto del blob

El campo que apunta al blob en el proveedor de almacenamiento se llama `cloud_url` en el esquema actual,
pero el patrón es agnóstico al proveedor. Si en el futuro se migra a otro servicio o se usa una
`storage_key` en lugar de una URL pública, el patrón sigue siendo válido. Lo que importa es que:

- El campo identifica el recurso **de forma global e independiente del dispositivo**.
- El campo viaja por el Sync Protocol (es parte del metadata).
- El campo lo actualiza el Asset Pipeline cuando el upload confirma el almacenamiento remoto.

#### Asset Locality Invariant

> **Ningún dato específico del dispositivo puede sincronizarse.**

Ejemplos de datos que **nunca** deben viajar por el protocolo:

- `local_uri` (ruta absoluta del sistema de archivos del dispositivo)
- Rutas absolutas del SO (`/storage/emulated/...`, `/var/mobile/...`)
- Identificadores de caché o permisos locales
- Flags de estado de UI efímera

**Invariante en backend**: Los endpoints de Asset Entities no deben aceptar, almacenar ni devolver
`local_uri` en ninguna circunstancia. Esta restricción se aplica en el controlador, no en el cliente.

**Invariante en cliente**: El sincronizador (`*Synchronizer.ts`) debe extraer y descartar `local_uri`
del payload entrante antes de cualquier operación de `upsert`. El Asset Engine (post-descarga) es el
único sistema autorizado para escribir `local_uri` en la base de datos local.

---

## 5. Ciclo de Vida

```
  ┌──────────┐
  │  CREATE  │──→ Push → Backend INSERT → incrementSyncVersion() → Delta Sync → todos los dispositivos
  └──────────┘
       │
       ▼
  ┌──────────┐
  │  UPDATE  │──→ Push → Backend UPDATE → incrementSyncVersion() → Delta Sync → todos los dispositivos
  └──────────┘
       │
       ▼
  ┌──────────┐
  │  DELETE  │──→ Push → Backend soft DELETE → recordDeletion() → Delta Sync (sync_deletions) → todos borran local
  └──────────┘
       │
       ▼
  ┌──────────┐
  │  RESTORE │──→ Push → Backend upsert (limpia sync_deletions) → incrementSyncVersion() → Delta Sync
  └──────────┘
```

### Estados locales (sync_queue)

| Estado | Significado |
|--------|-------------|
| `pending` | Pendiente de enviar |
| `failed` | Falló, se reintentará (hasta 5 veces) |
| `completed` | Enviado y confirmado (eliminado de cola) |
| `discarded` | Error permanente (400/404) o retries ≥ 5 |

### Estados de backend

| Estado | Significado |
|--------|-------------|
| `sync_version = N` | Última versión global conocida |
| `deleted_at != NULL` | Soft-deleted (visible solo para sync_deletions) |
| `sync_deletions.deletion_version = M` | Eliminación registrada, visible en delta sync |

---

## 6. Checklist de Incorporación

Al agregar una nueva SyncEntity, verificar cada punto en orden:

### 4.1 Schema
- [ ] Tabla creada en `database/schema.js` (sqlite + postgres + columns array)
- [ ] Tabla agregada en `tests/convergence/TestEnvironment.js` (TABLE_SCHEMAS)
- [ ] Tabla agregada en `tests/convergence/DeviceSimulator.js` (TABLE_DEFS)
- [ ] Migración agregada (si aplica) en backend

### 4.2 Columnas requeridas
- [ ] `id TEXT PRIMARY KEY`
- [ ] `user_id TEXT NOT NULL`
- [ ] `sync_version INTEGER DEFAULT 0`
- [ ] `deleted_at TEXT`
- [ ] `version_number INTEGER DEFAULT 0`
- [ ] FK a tabla padre (si corresponde)

### 4.3 Backend endpoints
- [ ] `POST /api/{entity-path}` — CREATE (con `incrementSyncVersion`)
- [ ] `PUT /api/{entity-path}/:id` — UPDATE (con `incrementSyncVersion` + sync_version guard)
- [ ] `DELETE /api/{entity-path}/:id` — DELETE (con `recordDeletion`)
- [ ] Endpoints registrados en `tests/convergence/TestEnvironment.js`

### 4.4 Sync Controller
- [ ] Entidad agregada a `initialSync` queries (con query SQL)
- [ ] Entidad agregada a `initialSync` response payload
- [ ] Entidad agregada a `deltaSync` regularTables list

### 4.5 Mobile
- [ ] API functions creadas en `services/api/{entity}.ts` (enqueueCreate, enqueueUpdate, enqueueDelete)
- [ ] Entity type registrado en `sync/validator/SyncValidator.ts`
- [ ] Entity rank definido en `sync/reducer/DependencyResolver.ts`

### 4.6 Test Framework
- [ ] Entity mapping en `DeviceSimulator.ENTITY_MAP`
- [ ] Entity mapping en `DeviceSimulator._pull()` (table key mapping)
- [ ] Entity mapping en `DeviceSimulator._pull()` (deletion mapping)
- [ ] Entity agregada a `SYNCABLE_TABLES`
- [ ] Entity agregada a `ConsistencyReport.TABLES`
- [ ] FK rules agregadas a `ConsistencyReport.FK_RULES`
- [ ] Generador en `SimulationEngine.ENTITY_GENERATORS`
- [ ] Pesos en `SimulationEngine.DEFAULT_WEIGHTS` / `LIGHT_WEIGHTS`

### 4.7 Pruebas
- [ ] Escenario de convergencia dedicado (CREATE → push → delta → verificar)
- [ ] Stress Suite verifica entidad en checkpoints
- [ ] Consistency Report incluye entidad
- [ ] `node tests/convergence/index.js` → PASS
- [ ] `node tests/stress/index.js smoke` → PASS

---

## 7. Perfiles de Entidad

No todas las SyncEntities son iguales. Se clasifican según su nivel de autonomía:

### Nivel A — Independiente
Tiene su propia tabla, endpoints, y no depende de otra entidad para existir.
Ejemplos: `subject`, `course`, `calendar-event`.

### Nivel B — Dependiente (FK obligatoria)
Requiere que una entidad padre exista en el backend antes de crearse.
Si el padre no está sincronizado, el endpoint responde `409 PARENT_NOT_SYNCED`.
Ejemplos: `flashcard` (depende de `flashcard-deck`), `audio-transcript` (depende de `audio-recording`).

### Nivel C — Asset entity
Nivel A o B que además posee un archivo binario (foto, audio, documento).
El metadata se sincroniza vía protocolo estándar; el archivo vía Asset Pipeline.
Ejemplos: `photo`, `audio-recording`, `scanned-document`.

### Nivel D — Derivada
No tiene endpoints propios. Se sincroniza indirectamente a través de una entidad padre
vía JOIN en delta sync. No tiene `sync_version` propia.
Ejemplos: `assessment-category` (JOIN con `subject` para filtrar por `user_id`).

---

## 8. Casos Límite

### 6.1 CREATE antes de que el padre exista en backend

```
Device A crea audio-recording (offline) → enqueue
Device A crea audio-transcript (offline) → enqueue
Device A sync → push audio-recording OK → push audio-transcript → 409 PARENT_NOT_SYNCED
  → Retry en próximo ciclo → audio-recording ya está en backend → 200 OK
```

Comportamiento esperado: el cliente reintenta. El backend responde 409 si la FK no se cumple,
nunca 500. La SyncEntity hija debe manejar este ciclo.

### 6.2 DELETE con cascade

```
Delete subject:
  1. Backend marca subject.deleted_at = now
  2. Backend busca courses, flashcard_decks, etc. con ese subject_id
  3. Cada hijo se marca como borrado (individualmente)
  4. Cada hijo se registra en sync_deletions
  5. Opcional: ON DELETE CASCADE en SQL (para tablas como audio_transcripts)
```

### 6.3 RESTORE (DELETE + CREATE mismo ID)

El `SyncQueueReducer` detecta el patrón y produce una operación `RESTORE`.
El backend upsert + `removeDeletion()`. Previene "borrados fantasma" en otros dispositivos.

### 6.4 Asset entity con metadata corrupta pero blob intacto

El `AssetValidator` detecta checksum mismatch post-descarga. La entidad se marca como
`asset_state = 'corrupted'`. El metadata permanece sincronizado; el blob se reintenta.

---

## 9. Criterios de Certificación

Una SyncEntity se considera **oficialmente integrada** cuando:

1. **Cumple los 10 invariantes** (sección 2)
2. **Checklist completo** (sección 4) — cada punto verificado
3. **Pruebas automáticas pasan**:
   - Convergence Suite: escenario dedicado o cobertura explícita
   - Stress Suite smoke: 100% Convergence Score, 0 errores
   - Consistency Report: backend = dispositivo A = dispositivo B
4. **Documentación actualizada**:
   - `SYNC_PROTOCOL.md` tabla de entidades (sección 10)
   - `AGENTS.md` sección de progreso y archivos relevantes

---

## 10. Registro de Entidades (21)

> Actualizado en el **Sprint de Normalización Sync v1.0** (Julio 2026).
> Las entidades marcadas con 🆕 fueron integradas en este sprint.

| Entidad | Tabla | Patrón | Nivel | Asset | Escenario dedicado |
|---------|-------|--------|-------|-------|--------------------|
| subject | `subjects` | Standard | A | No | 001–008, 010 |
| course | `courses` | Standard | A | No | 007 |
| flashcard-deck | `flashcard_decks` | Standard | A | No | 009 |
| flashcard | `flashcards` | Standard | B (deck) | No | 009 |
| assessment | `assessments` | Standard | A | No | — (Stress Suite) |
| assessment-category | `assessment_categories` | Standard | D (subject) | No | — (Stress Suite) |
| schedule | `schedules` | Standard | A | No | — (Stress Suite) |
| calendar-event | `calendar_events` | Standard | A | No | — (Stress Suite) |
| grading-period | `grading_periods` | Standard | A | No | — (Stress Suite) |
| lms-account | `lms_accounts` | Standard | A | No | — (Stress Suite) |
| threshold-override | `subject_threshold_overrides` | Standard | A | No | — (Stress Suite) |
| study-session | `study_sessions` | Standard | A | No | — (Stress Suite) |
| photo | `photos` | Asset | A | Sí | — (Stress Suite) |
| audio-recording | `audio_recordings` | Asset | A | Sí | — (Stress Suite) |
| audio-transcript | `audio_transcripts` | Standard | B (recording) | No | 011 |
| scanned-document | `scanned_documents` | Asset | A | Sí | — (Stress Suite) |
| youtube-video | `youtube_videos` | Standard | A | No | — (Stress Suite) 🆕 |
| youtube-transcript | `youtube_transcripts` | Standard | B (video) | No | — (Stress Suite) |
| ai-chat | `ai_chats` | Standard | A | No | — (Stress Suite) 🆕 |
| assessment-file | `assessment_files` | Asset | B (assessment) | Sí | — (Stress Suite) 🆕 |

### Tabla de Entidades No Sincronizables

| Tabla | Categoría | Razón de exclusión |
|-------|-----------|--------------------|
| `card_logs` | Infraestructura / Auditoría | Datos históricos de review. No tienen identidad global. Excluidos intencionalmente del cascade. |
| `user_preferences` | Legacy / Pendiente de rediseño | PK incorrecta (`key` sin `user_id`). Sin consumidores activos. Requiere rediseño completo antes de sincronizar. |
| `sync_queue` | Infraestructura | Cola local del protocolo. No es un dato del dominio. |
| `sync_journal` | Infraestructura | Registro de ciclos de sync. No es un dato del dominio. |
| `sync_debug_logs` | Infraestructura | Trazabilidad interna. No cruza dispositivos. |

---

## 11. Glosario

| Término | Definición |
|---------|------------|
| **SyncEntity** | Entidad sincronizable (cumple los 10 invariantes) |
| **sync_version** | Contador global de mutaciones. Entero monotónico. |
| **deletion_version** | Versión asignada a una eliminación. Paralelo a sync_version. |
| **sync_queue** | Cola local de operaciones pendientes (CREATE/UPDATE/DELETE) |
| **SyncQueueReducer** | Compactador de cola: elimina operaciones redundantes antes del push |
| **Delta Sync** | Pull incremental: solo entidades con `sync_version > lastVersion` |
| **Initial Sync** | Pull completo: todas las entidades del usuario |
| **Consistency Report** | Verificación post-suite: compara backend vs dispositivos |
| **Convergence Score** | % de entidades que coinciden entre backend y todos los dispositivos |
| **Asset Pipeline** | Pipeline paralelo para subir/bajar archivos binarios |
| **Standard Entity Pattern** | Patrón de entidad donde toda la información viaja por el protocolo |
| **Asset Entity Pattern** | Patrón de entidad donde los metadatos van por el protocolo y el blob por el Asset Pipeline |
| **Asset Locality Invariant** | Regla que prohíbe sincronizar datos específicos del dispositivo (como `local_uri`) |
| **LWW** | Last Writer Wins — estrategia de conflicto por defecto |

---
**Tags:** #sync
