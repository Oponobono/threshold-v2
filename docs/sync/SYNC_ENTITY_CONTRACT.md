# Sync Entity Contract v1.0

> **Propósito**: Checklist ejecutable para incorporar una nueva entidad al Sync Protocol de Threshold.
> Una entidad no se considera "lista" hasta cumplir **todos** los puntos de este documento.
>
> Documento relacionado: [`SYNC_ENTITY_SPEC.md`](./SYNC_ENTITY_SPEC.md) — especificación completa del protocolo.

---

## Por qué existe este documento

Antes de este contrato, la respuesta a "¿cómo integro una entidad nueva?" era *"depende"*.

Ahora la respuesta es:

1. Clasificar la tabla.
2. Si es sincronizable, auditar su modelo de datos.
3. Elegir el patrón de implementación (Standard o Asset).
4. Cumplir los 7 puntos del contrato.
5. Validar mediante el flujo vertical completo.

Ese proceso elimina las "entidades a medias": entidades que existen en el backend pero nunca llegan a otros dispositivos, o que se sincronizan pero no eliminan, o que se eliminan pero dejan huérfanos.

---

## Fase 0 — Clasificación

**Antes de escribir una sola línea de código**, responder esta pregunta:

> ¿A qué categoría pertenece esta tabla?

| Categoría | Descripción | ¿Entra al protocolo? |
|-----------|-------------|----------------------|
| **Entidad Sincronizable** | Tiene identidad global, pertenece al usuario, debe converger entre dispositivos | ✅ Sí — seguir con Fase 1 |
| **Entidad Local** | Solo existe en el dispositivo, no tiene identidad global | ❌ No |
| **Infraestructura** | Soporte del propio protocolo (`sync_queue`, `sync_journal`) | ❌ No |
| **Legacy / Pendiente de rediseño** | Modelo incorrecto o sin consumidores activos | ❌ No — documentar razón |

> **Regla**: Si la tabla no puede clasificarse con certeza en "Entidad Sincronizable", no debe entrar al protocolo.
> La ambigüedad es una señal de diseño incompleto, no un caso especial a resolver con código.

---

## Fase 1 — Auditoría del Modelo de Datos

Responder explícitamente cada pregunta. No asumir — verificar en el esquema actual.

| Campo | Pregunta | Respuesta esperada |
|-------|----------|--------------------|
| **PK** | ¿Cuál es la clave primaria? ¿Es un UUID global? | `id TEXT PRIMARY KEY` (UUID) |
| **Owner** | ¿Tiene `user_id`? ¿Es directo o via JOIN? | Directo preferido; JOIN documentado |
| **Dependencias** | ¿De qué entidades depende via FK? ¿Deben sincronizarse primero? | Listar FK obligatorias |
| **sync_version** | ¿Existe la columna `sync_version INTEGER DEFAULT 0`? | Sí — si no, crearla en migración |
| **updated_at** | ¿Existe `updated_at`? ¿Se actualiza en cada mutación? | Sí — `DEFAULT (datetime('now'))` |
| **version_number** | ¿Existe `version_number INTEGER NOT NULL DEFAULT 0`? | Sí — si no, crearla en migración |
| **Borrado** | ¿Puede eliminarse? ¿Soft-delete (`deleted_at`) o hard-delete + `sync_deletions`? | `sync_deletions` obligatorio si es eliminable |

> Si algún campo falta, crear la migración **antes** de continuar. Los endpoints vienen después del esquema.

---

## Fase 2 — Elegir el Patrón de Implementación

Toda entidad sincronizable implementa **exactamente uno** de estos patrones:

### Patrón A — Standard Entity

Toda la información viaja por el Sync Protocol.

**Condición**: la entidad no posee archivos binarios (PDFs, imágenes, audios).

```
Cliente → sync_queue → PUT /api/{entity}/:id → incrementSyncVersion() → Delta Sync → todos los dispositivos
```

**Ejemplos**: `subjects`, `assessments`, `ai_chats`, `youtube_videos`, `flashcards`.

---

### Patrón B — Asset Entity

La entidad se divide en dos responsabilidades:

| Responsabilidad | Propietario | Qué incluye |
|----------------|------------|-------------|
| **Metadata** | Sync Protocol | `id`, `user_id`, relaciones, `file_name`, `file_type`, `file_size`, identificador remoto del blob |
| **Binario (Blob)** | Asset Pipeline | El archivo físico (PDF, JPG, MP3, etc.) |

**Condición**: la entidad posee un archivo binario gestionado por Uploadthing u otro proveedor.

```
Metadata: Cliente → sync_queue → PUT /api/{entity}/:id → Delta Sync (JSON only)
Binario:  Cliente → Upload Queue → Storage Provider → cloud_url
```

**Ejemplos**: `photos`, `audio_recordings`, `scanned_documents`, `assessment_files`.

#### Asset Locality Invariant

> **Ningún dato específico del dispositivo puede sincronizarse.**

Datos que **nunca** deben viajar por el protocolo:

- `local_uri` (ruta absoluta del sistema de archivos)
- Rutas absolutas del SO (`/storage/emulated/...`, `/var/mobile/...`)
- Identificadores de caché o permisos locales

**En backend**: el controller no acepta, almacena ni devuelve `local_uri`.

**En cliente**: el `*Synchronizer.ts` extrae y descarta `local_uri` del payload antes de cualquier `upsert`. Solo el Asset Engine (post-descarga) puede escribir `local_uri` en SQLite.

---

## Fase 3 — Los 7 Puntos del Contrato

Una entidad no es "lista" hasta que cumple los 7 puntos. Marcar cada uno al completarlo.

### 1. ✅ Initial Sync

La entidad aparece en `GET /api/sync/initial`.

- [ ] Query SQL agregada en `syncController.js → initialSync`
- [ ] Campo incluido en el objeto de respuesta de `initialSync`
- [ ] El cliente lee y persiste estos datos en el `*Synchronizer.ts` correspondiente

**Verificación**: llamar a `GET /api/sync/initial` y confirmar que la entidad aparece en el payload.

---

### 2. ✅ Delta Sync

La entidad aparece en `GET /api/sync/delta`.

- [ ] Entidad agregada a `regularTables` en `deltaSync` (si `user_id` es directo), **o**
- [ ] Query SQL dedicada en `specialTableQueries` (si `user_id` requiere JOIN)
- [ ] El `WHERE` usa `sync_version > ?` con el `user_id` correcto

**Verificación**: crear una entidad, sincronizar, verificar que aparece en el siguiente delta.

---

### 3. ✅ Endpoints CRUD con Version Guards

El backend expone los tres endpoints obligatorios con control de concurrencia.

- [ ] `POST /api/{entity-path}` — CREATE
  - Usa `INSERT ... ON CONFLICT(id) DO UPDATE SET` (idempotente)
  - Llama a `incrementSyncVersion(table, id)` tras el INSERT/UPSERT
  - Llama a `removeDeletion(table, id, userId)` si es un RESTORE
- [ ] `PUT /api/{entity-path}/:id` — UPDATE
  - Usa `updateWithVersionGuard(table, id, columns, values, incomingVersion)`
  - Responde `409` si `sync_version` del cliente es menor al del servidor
  - Llama a `incrementSyncVersion(table, id)` tras el UPDATE
- [ ] `DELETE /api/{entity-path}/:id` — DELETE
  - Llama a `recordDeletion(table, id, userId)` antes o después del DELETE físico
  - Llama a `incrementSyncCounterOnly()` para avanzar el contador global

**Verificación**: probar 409 enviando un `sync_version` obsoleto en un PUT.

---

### 4. ✅ Enqueue Local al Mutar

Cada operación del cliente encola la mutación antes de ejecutarla localmente.

- [ ] `enqueueCreate(entity)` definida en `mobile/src/services/api/{entity}.ts`
- [ ] `enqueueUpdate(id, fields)` definida con el tipo de entidad correcto
- [ ] `enqueueDelete(id)` definida con soft-delete local si aplica
- [ ] El tipo de operación está registrado en `SyncValidator.ts`
- [ ] El rank de dependencia está definido en `DependencyResolver.ts` (para ordenamiento topológico)

**Verificación**: crear/editar/borrar en modo offline → verificar que aparece en `sync_queue` con el tipo correcto.

---

### 5. ✅ enqueueLegacyUnsyncedData

Los datos creados antes de que la entidad fuera sincronizable se migran a la cola.

- [ ] Entidad agregada a la lista en `SyncService.ts → enqueueLegacyUnsyncedData()`
- [ ] El `SELECT` filtra por `sync_version = 0` o `sync_version IS NULL`
- [ ] La función es idempotente (ejecutarla 2 veces no duplica operaciones)

**Verificación**: con datos existentes (`sync_version = 0`), ejecutar el método y confirmar que se encolan exactamente una vez.

---

### 6. ✅ Dependency Resolver

La entidad tiene un rank definido para el ordenamiento topológico de la cola.

- [ ] Rank definido en `DependencyResolver.ts`
- [ ] Rank es mayor al de todas sus entidades padre (FK obligatorias)
- [ ] Rank es menor al de todas sus entidades hija

**Referencia de ranks** (extracto):

```
subjects: 10  →  courses: 20  →  assessments: 30  →  assessment_files: 35
                              →  flashcard_decks: 30  →  flashcards: 40
```

---

### 7. ✅ sync_deletions (si la entidad es eliminable)

Las eliminaciones se registran para que otros dispositivos borren la entidad.

- [ ] `DELETE` en backend llama a `recordDeletion(table, id, userId)`
- [ ] `deleteItem(id)` implementado en el `*Synchronizer.ts`
- [ ] El `*Synchronizer.ts` registrado en `SyncManager` (para procesar deletes del delta)
- [ ] Si hay cascade: las entidades hijas también registran `recordDeletion` individualmente

**Verificación**: borrar la entidad en Device A → sincronizar → confirmar que desaparece en Device B.

---

## Fase 4 — Validación Vertical

Antes de declarar la entidad como integrada, ejecutar este flujo completo:

```
┌─────────────────────────────────────────────────────────┐
│  Device A (offline)                                      │
│  1. CREATE entidad → aparece en sync_queue              │
│  2. UPDATE entidad → sync_queue compacta a 1 operación  │
│  3. DELETE entidad → sync_queue = no-op (CREATE→DELETE) │
└─────────────────────────────────────────────────────────┘
         │ Device A se conecta
         ▼
┌─────────────────────────────────────────────────────────┐
│  Sync push → Backend recibe CREATE                      │
│  sync_version se incrementa                             │
│  sync_deletions registra el DELETE                      │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Device B hace delta sync                               │
│  Recibe la entidad via updated[]                        │
│  Recibe el delete via deletions[]                       │
│  Estado de B converge con estado de A                   │
└─────────────────────────────────────────────────────────┘
```

**Checklist de validación**:

- [ ] Entidad creada offline → aparece en backend tras sync
- [ ] Entidad editada en Device A → Device B la ve actualizada tras delta sync
- [ ] Entidad eliminada en Device A → Device B la elimina tras delta sync
- [ ] `enqueueLegacyUnsyncedData` es idempotente (ejecutar 2x = mismo resultado)
- [ ] Version guard funciona: PUT con `sync_version` obsoleto → `409`
- [ ] `ConsistencyReport` reporta `backend = deviceA = deviceB`

---

## Registro de Entidades Certificadas

Entidades que han completado este contrato:

| Entidad | Patrón | Certificada | Notas |
|---------|--------|-------------|-------|
| `subjects` | Standard | ✅ | Entidad raíz. Cascade hacia 12+ entidades hijas. |
| `courses` | Standard | ✅ | |
| `flashcard_decks` | Standard | ✅ | |
| `flashcards` | Standard | ✅ | Depende de `flashcard_decks` |
| `assessments` | Standard | ✅ | |
| `assessment_categories` | Standard | ✅ | `user_id` via JOIN `subjects` |
| `schedules` | Standard | ✅ | |
| `calendar_events` | Standard | ✅ | |
| `grading_periods` | Standard | ✅ | |
| `lms_accounts` | Standard | ✅ | |
| `subject_threshold_overrides` | Standard | ✅ | |
| `study_sessions` | Standard | ✅ | |
| `photos` | Asset | ✅ | `user_id` via JOIN `subjects` |
| `audio_recordings` | Asset | ✅ | |
| `audio_transcripts` | Standard | ✅ | Depende de `audio_recordings` |
| `scanned_documents` | Asset | ✅ | |
| `youtube_videos` | Standard | ✅ | Sprint Normalización Jul 2026 |
| `youtube_transcripts` | Standard | ✅ | Depende de `youtube_videos` |
| `ai_chats` | Standard | ✅ | Sprint Normalización Jul 2026. Append-only. |
| `assessment_files` | Asset | ✅ | Sprint Normalización Jul 2026. `user_id` via JOIN `assessments → subjects`. |

---

## Entidades Excluidas del Protocolo

| Tabla | Categoría | Razón |
|-------|-----------|-------|
| `card_logs` | Infraestructura / Auditoría | Datos históricos de review. Sin identidad global. Excluidos intencionalmente del cascade. |
| `user_preferences` | Legacy / Pendiente de rediseño | PK `key` sin `user_id`. Sin consumidores activos. Requiere rediseño completo del modelo K/V antes de sincronizar. |
| `sync_queue` | Infraestructura | Cola local. No es un dato del dominio. |
| `sync_journal` | Infraestructura | Bitácora de ciclos. No cruza dispositivos. |
| `sync_debug_logs` | Infraestructura | Trazabilidad interna. No cruza dispositivos. |

---

## Glosario Rápido

| Término | Definición |
|---------|------------|
| **Standard Entity Pattern** | Toda la información de la entidad viaja por el Sync Protocol |
| **Asset Entity Pattern** | Metadata por Sync Protocol; blob físico por Asset Pipeline |
| **Asset Locality Invariant** | Ningún dato específico del dispositivo puede sincronizarse |
| **enqueueLegacyUnsyncedData** | Migración de datos creados antes de que la entidad fuera sincronizable |
| **Version Guard** | Rechazo con 409 si el `sync_version` del cliente está obsoleto respecto al servidor |
| **Dependency Resolver** | Ordena topológicamente la cola para que las entidades padre se sincronicen antes que las hijas |
| **sync_deletions** | Tabla que registra eliminaciones para propagarlas a otros dispositivos via delta sync |

---
**Tags:** #sync #contract #onboarding
