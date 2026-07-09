# Sync Protocol v1.0

> Estado: **Congelado**. Este documento describe el protocolo de sincronización en producción.
> Fecha: Julio 2026

---

## 1. Arquitectura General

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Device A    │────▶│  Sync Queue     │────▶│  Backend API │
│  (SQLite)    │◀────│  (local SQLite) │◀────│  (Express)   │
└─────────────┘     └─────────────────┘     └──────────────┘
       │                                          │
       ▼                                          ▼
┌─────────────────┐                     ┌──────────────────┐
│  SyncQueueReducer│                    │  sync_version     │
│  (compactación)  │                    │  sync_deletions   │
└─────────────────┘                    └──────────────────┘
```

Cada ciclo de sync: **Push queue → Pull delta → Verificar convergencia**.

---

## 2. Estructura de Eventos

### Sync Queue (local, SQLite)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | INTEGER PK | Auto-increment |
| `entity_type` | TEXT | `subject`, `course`, `flashcard-deck`, etc. |
| `entity_id` | TEXT | UUID |
| `operation` | TEXT | `CREATE`, `UPDATE`, `DELETE` |
| `payload` | TEXT | JSON stringify |
| `status` | TEXT | `pending` (default), `failed` |
| `retries` | INTEGER | 0–5, descartado al llegar a 5 |
| `error` | TEXT | Mensaje del último error |
| `trace_id` | TEXT | Para debugging distribuido |
| `created_at` | TEXT | Timestamp |

### Reduced Operation (post-reducer)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `operation` | TEXT | `CREATE`, `UPDATE`, `DELETE`, `RESTORE` |
| `entity_type` | TEXT | Tipo de entidad |
| `entity_id` | TEXT | UUID |
| `payload` | any | Datos finales (merged de todos los eventos) |
| `originalIds` | int[] | IDs originales en sync_queue |

### RESTORE semantics

`RESTORE` aparece cuando hay secuencia `DELETE + CREATE` (mismo ID) en la cola.
El `SyncService` lo traduce a `CREATE` para el handler. El backend upserta la fila y limpia `sync_deletions`.

---

## 3. Ciclo de Sync

### 3.1 Push (upload)

1. **Enqueue**: operación se guarda en `sync_queue` local con status `pending`
2. **Reduce**: `SyncQueueReducer` compacta operaciones por `(entity_type, entity_id)`:

   | Secuencia | Resultado |
   |-----------|-----------|
   | `CREATE` | `CREATE` |
   | `UPDATE` | `UPDATE` |
   | `DELETE` | `DELETE` |
   | `CREATE+DELETE` | no-op (eliminado) |
   | `DELETE+CREATE` | `RESTORE` |
   | `CREATE+UPDATE+DELETE` | no-op |
   | `DELETE+CREATE+UPDATE` | `RESTORE` |
   | `UPDATE+UPDATE+UPDATE` | `UPDATE` (payload merged) |
   | `CREATE+UPDATE+UPDATE` | `CREATE` (payload merged) |

3. **Orden topológico**: `DependencyResolver` ordena por tipo: `subject > course > flashcard-deck > flashcard > ...`
4. **Execute**: HTTP request al backend:

   | Operación | Método | Endpoint |
   |-----------|--------|----------|
   | CREATE | POST | `/api/{entity-path}` |
   | UPDATE | PUT | `/api/{entity-path}/{id}` |
   | DELETE | DELETE | `/api/{entity-path}/{id}` |
   | RESTORE | POST | `/api/{entity-path}` (traducido a CREATE) |

   Headers: `Authorization: Bearer <jwt>`, `Content-Type: application/json`, `X-Trace-Id: <guid>`

5. **Response handling**:
   - `2xx`: eliminar de `sync_queue`, actualizar `lastSyncVersion`
   - `409 (Conflict)`: incrementar `retries`, registrar conflicto en métricas
   - `400/404 (Bad Request/Not Found)`: descartar permanentemente (error permanente)
   - `5xx/network`: incrementar `retries`, reintentar en próximo ciclo
   - `retries >= 5`: descartar permanentemente

### 3.2 Pull (download)

#### Initial Sync

```
GET /api/sync/initial
Authorization: Bearer <jwt>
→ 200 { syncVersion, payload: { user, courses, subjects, assessments,
    schedules, flashcard_decks, flashcards, settings,
    calendar_events, notifications }, deleted }
```

- Devuelve **todas las entidades** del usuario (sin filtro de versión)
- Se ejecuta cuando `lastSyncVersion === 0`
- `payload` incluye 10 categorías de entidades

#### Delta Sync

```
GET /api/sync/delta?version=<lastSyncVersion>
Authorization: Bearer <jwt>
→ 200 { syncVersion, updated: { courses: [...], subjects: [...], ... }, deleted: [...] }
```

- **15 tablas regulares**: `courses`, `subjects`, `assessments`, `schedules`, `flashcard_decks`, `flashcards`, `calendar_events`, `grading_periods`, `lms_accounts`, `subject_threshold_overrides`, `study_sessions`, `photos`, `audio_recordings`, `scanned_documents`
- **1 tabla especial**: `assessment_categories` (JOIN con subjects)
- Query: `WHERE user_id = ? AND sync_version > ?`
- **Deletions**: `SELECT * FROM sync_deletions WHERE user_id = ? AND COALESCE(deletion_version, 0) > ?`
- Contador: `total = allTableKeys.length + 2` (tables + deletions + syncVersion fetch)

### 3.3 Procesamiento local (post-pull)

```typescript
for (const [table, entities] of Object.entries(updated)) {
  for (const entity of entities) {
    INSERT OR REPLACE INTO <table> VALUES (...)  // upsert
  }
}
for (const d of deleted) {
  DELETE FROM <table> WHERE id = d.entityId
}
client.lastSyncVersion = response.syncVersion
```

---

## 4. Versionado

### 4.1 sync_version (mutaciones)

- **Global**: tabla `sync_version(id=1, version INTEGER, updated_at)`
- **Per-row**: columna `sync_version` en cada tabla syncable
- **Incremento**: cada escritura CREATE/UPDATE/DELETE llama `incrementSyncVersion()`
  ```sql
  UPDATE sync_version SET version = version + 1, updated_at = datetime('now') WHERE id = 1
  ```
- **Guard en UPDATE**: backend compara `sync_version` entrante vs actual, rechaza con 409 si el cliente está obsoleto
- **Guard en CREATE**: `ON CONFLICT(id) DO UPDATE SET ... WHERE sync_version IS NULL OR sync_version <= ?`
- **Delta query**: `WHERE sync_version > ?`

### 4.2 deletion_version (borrados)

- **Parallel a sync_version**: se asigna `deletion_version` a cada fila en `sync_deletions`
- **Delta query**: `COALESCE(deletion_version, 0) > ?`
- **Propósito**: `deleted_at` es solo audit/metadata; **toda decisión de sync usa `deletion_version`**

### 4.3 version_number (local)

- **Per-entity**: contador local para detección de conflictos
- **Auto-increment**: `COALESCE(version_number, 0) + 1` (o explícito si se pasa)
- **Uso**: comparación en `ConflictResolver`, no en queries de delta

---

## 5. Conflicto de Escritura

### Estrategias

| Estrategia | Descripción | Entidades |
|------------|-------------|-----------|
| `LAST_WRITE_WINS` | Gana el `updated_at` más reciente (default) | subjects, courses, assessments, photos, audio, etc. |
| `SERVER_WINS` | Siempre gana el servidor | analytics |
| `CLIENT_WINS` | Siempre gana el cliente | schedules, settings |
| `MERGE` | Union de campos no-nulos | flashcard_decks, flashcards |

### Merge semantics

```typescript
merged = { ...remote.data }
for (key of local.data) {
  if (remote[key] es null/undefined pero local[key] existe)
    merged[key] = local[key]
}
winner = (merged !== remote) ? 'merged' : 'remote'
version_number = max(local.version_number, remote.version_number) + 1
```

### Backend guard

Cuando un cliente envía un UPDATE con `sync_version` menor al actual:

```javascript
const query = `
  UPDATE <table> SET ... WHERE id = ? AND sync_version <= ?
`
if (result.changes === 0) → 409 Conflict
```

---

## 6. Borrado

### Soft Delete

```sql
-- Backend:
UPDATE subjects SET deleted_at = datetime('now') WHERE id = ?
INSERT INTO sync_deletions (entity_type, entity_id, user_id, deletion_version)
  VALUES ('subject', ?, ?, <next_version>)
```

- `deleted_at` se mantiene como columna en cada tabla
- `sync_deletions` rastrea qué entidades fueron borradas y en qué versión
- Los clientes borran filas localmente al recibir `deleted` en delta sync

### RESTORE

Cuando un cliente hace DELETE seguido de CREATE (mismo ID):
1. `SyncQueueReducer` detecta patrón y produce `RESTORE`
2. Backend ejecuta `INSERT ... ON CONFLICT(id) DO UPDATE SET ...`
3. Backend llama `removeDeletion()` para limpiar `sync_deletions`
4. Previene "borrados fantasma" en otros dispositivos

### Cascade

Delete de subject:
1. Marca subject como borrado
2. Busca courses, flashcards decks, etc. hijos
3. Marca cada hijo como borrado
4. Registra cada hijo en `sync_deletions`

---

## 7. Reducer

### Propósito

Elimina operaciones redundantes antes de enviarlas al backend. Reduce ancho de banda, conflictos, y carga del servidor.

### Algoritmo

```
reduce(pending: SyncQueueItem[]) → { operations: ReducedOperation[], report: ReductionReport }

1. Agrupar por (entity_type, entity_id)
2. Por cada grupo, aplicar máquina de estados (ver §3.1)
3. Ordenar topológicamente por DependencyResolver
4. Validar campos requeridos y existencia de entidades
5. Generar ReductionReport
```

### Propiedades

- **Determinismo**: `reduce(reduce(q)) === reduce(q)`
- **Idempotencia**: aplicar reducer múltiples veces no cambia el resultado
- **Orden original preservado**: `originalIds` permite rastrear origen

---

## 8. Códigos de Error

| Código | Significado | Acción del cliente |
|--------|-------------|--------------------|
| `200` | OK | Eliminar de cola, actualizar `lastSyncVersion` |
| `400` | Malformed request | Descartar permanentemente |
| `404` | Entity not found / parent missing | Descartar permanentemente (ORPHAN_DROP) |
| `409` | Stale client (sync_version behind) | Reintentar (incrementa retries). Re-sync opcional. |
| `429` | Rate limited | Retry con backoff exponencial |
| `500` | Server error | Retry (hasta 5) |

---

## 9. Garantías del Protocolo

### Idempotencia

Todo CREATE usa `INSERT ... ON CONFLICT(id) DO UPDATE SET` — múltiples envíos del mismo ID no causan errores de duplicado.

### Monotonicidad

`sync_version` solo incrementa. Cada escritura en backend avanza el contador global. Un cliente con versión `N + 1` siempre tiene al menos los datos de `N`.

### Convergencia

Dos dispositivos que han visto el mismo `sync_version` tienen el mismo estado de datos para todas las entidades sincronizadas.

Verificado por `ConsistencyReport`: compara conteo de filas por tabla entre backend y todos los dispositivos.

### At-least-once delivery

Operaciones se reintentan hasta 5 veces. Errores 4xx (permanentes) se descartan temprano. Errores 5xx/network reintentan.

### Orden causal

`DependencyResolver` asegura que CREATEs de padres ocurran antes que CREATEs de hijos (subject → course → flashcard-deck → flashcard).

---

## 10. Entidades Syncables (15)

| Tipo | Tabla Backend | CREATE Endpoint | Priority |
|------|---------------|-----------------|----------|
| subject | `subjects` | `POST /api/subjects` | 1 |
| course | `courses` | `POST /api/courses` | 2 |
| flashcard-deck | `flashcard_decks` | `POST /api/flashcard-decks` | 3 |
| flashcard | `flashcards` | `POST /api/flashcard-decks/{id}/cards` | 4 |
| assessment | `assessments` | `POST /api/assessments` | 5 |
| assessment-category | `assessment_categories` | (via delta sync) | 5 |
| schedule | `schedules` | `POST /api/schedules` | 6 |
| calendar-event | `calendar_events` | `POST /api/calendar/events` | 7 |
| grading-period | `grading_periods` | (via delta sync) | 8 |
| lms-account | `lms_accounts` | (via delta sync) | 8 |
| threshold-override | `subject_threshold_overrides` | (via delta sync) | 8 |
| study-session | `study_sessions` | (via delta sync) | 9 |
| photo | `photos` | `POST /api/gallery` | 10 (asset pipeline) |
| audio-recording | `audio_recordings` | `POST /api/audio` | 10 (asset pipeline) |
| scanned-document | `scanned_documents` | `POST /api/documents` | 10 (asset pipeline) |

---

## 11. Endpoints

| Ruta | Método | Auth | Descripción |
|------|--------|------|-------------|
| `/api/sync/initial` | GET | JWT | Full dump inicial (10 categorías) |
| `/api/sync/delta?version=N` | GET | JWT | Delta sync (15 tablas + deletions) |
| `/api/subjects` | POST | JWT | Crear subject |
| `/api/subjects/:id` | PUT | JWT | Actualizar subject (sync_version guard) |
| `/api/subjects/:id` | DELETE | JWT | Borrar subject (cascade) |
| `/api/courses` | POST | JWT | Crear course |
| `/api/courses/:id` | PUT | JWT | Actualizar course (sync_version guard) |
| `/api/courses/:id` | DELETE | JWT | Borrar course |
| `/api/flashcard-decks` | POST | JWT | Crear deck |
| `/api/flashcard-decks/:id` | PUT | JWT | Actualizar deck (sync_version guard) |
| `/api/flashcard-decks/:id` | DELETE | JWT | Borrar deck |
| `/api/flashcard-decks/:id/cards` | POST | JWT | Crear card |
| `/api/flashcards/:id` | PUT | JWT | Actualizar card (sync_version guard) |

---

## 12. Asset Pipeline (Sprint 2)

Los assets (fotos, audio, documentos) siguen un pipeline separado:

```
CREATE (local) → Enqueue → Sync CREATE (JSON metadata) → 
AssetUploadManager (blob, 2 concurrentes, retry exponencial) → 
checksum verification → cloud_url actualizado
```

- `AssetSyncEngine` orquesta uploads/downloads
- `AssetDownloadManager`: 3 concurrentes, checksums, prioridades, resume
- `PersistentLocalAssetStore`: LRU eviction (3GB)
- `AssetValidator`: checksum post-descarga, detección de corruptos
- Integrado en `SyncManager` como fase paralela

---

## 13. Seguridad

- JWT en header `Authorization: Bearer <token>`
- Cada endpoint valida `req.user.id` contra `user_id` en queries
- `sync_version` guard previene escrituras obsoletas
- SQLite como única fuente de verdad para datos de negocio
- MMKV reservado para JWT, tokens, flags, configuración, metadatos

---

## 14. Migración

### De v0 (pre-protocol) a v1.0

1. **Schema**: migration v21 agrega `version_number`, `last_modified_by`, `deleted_at` en 10 tablas
2. **Dual Write**: backend escribe `sync_version` + escribe columnas legacy
3. **Delta Sync**: migrado a usar `WHERE sync_version > ?`
4. **Test Validation**: Convergence Test Suite (10/10) + Stress Suite (1000×3 PASS)
5. **Cleanup**: confirmado — cero decisiones de sync dependen de `deleted_at`

### Próximos pasos

- Stress Suite expansion (5000+ ops, RandomScenario)
- Asset Pipeline integrado en SimulationEngine
- Dashboard de salud del Sync Engine


---
**Tags:** #sync
