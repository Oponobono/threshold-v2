# Sync Protocol v1.0

> Estado: **Congelado**. Protocolo de sincronización en producción.

## Arquitectura General

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

## Estructura de Eventos

### Sync Queue (local, SQLite)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `entity_type` | TEXT | `subject`, `course`, `flashcard-deck`, etc. |
| `entity_id` | TEXT | UUID |
| `operation` | TEXT | `CREATE`, `UPDATE`, `DELETE` |
| `payload` | TEXT | JSON stringify |
| `status` | TEXT | `pending` (default), `failed` |
| `retries` | INTEGER | 0–5, descartado al llegar a 5 |
| `trace_id` | TEXT | Para debugging distribuido |

### Reduced Operation (post-reducer)

| Campo | Tipo | Descripción |
|---|---|---|
| `operation` | TEXT | `CREATE`, `UPDATE`, `DELETE`, `RESTORE` |
| `entity_type` | TEXT | Tipo de entidad |
| `entity_id` | TEXT | UUID |
| `payload` | any | Datos finales (merged de todos los eventos) |
| `originalIds` | int[] | IDs originales en sync_queue |

### RESTORE semantics

`RESTORE` aparece cuando hay secuencia `DELETE + CREATE` (mismo ID). El `SyncService` lo traduce a `CREATE`. El backend upserta la fila y limpia `sync_deletions`.

## Ciclo de Sync

### Push (upload)

1. **Enqueue**: operación se guarda en `sync_queue` local con status `pending`
2. **Reduce**: `SyncQueueReducer` compacta operaciones por `(entity_type, entity_id)`
3. **Orden topológico**: `DependencyResolver` ordena por tipo: `subject > course > flashcard-deck > flashcard > ...`
4. **Execute**: HTTP request al backend con headers de auth y trace
5. **Response handling**: 2xx → eliminar; 409 → reintentar; 400/404 → descartar; 5xx → retry (max 5)

### Pull (download)

**Initial Sync**: `GET /api/sync/initial` — 10 categorías de entidades, sin filtro de versión.

**Delta Sync**: `GET /api/sync/delta?version=<lastSyncVersion>` — 15 tablas regulares + 1 especial + sync_deletions.

### Procesamiento local (post-pull)

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

## Versionado

### sync_version (mutaciones)

- **Global**: tabla `sync_version(id=1, version INTEGER, updated_at)`
- **Per-row**: columna `sync_version` en cada tabla syncable
- **Guard en UPDATE**: `WHERE id = ? AND sync_version <= ?` → 409 si no hay cambios
- **Guard en CREATE**: `ON CONFLICT(id) DO UPDATE SET ... WHERE sync_version IS NULL OR sync_version <= ?`

### deletion_version (borrados)

- Parallel a sync_version, asignado a cada fila en `sync_deletions`
- Delta query: `COALESCE(deletion_version, 0) > ?`
- `deleted_at` es solo audit/metadata; toda decisión de sync usa `deletion_version`

## Conflicto de Escritura

| Estrategia | Descripción | Entidades |
|---|---|---|
| `LAST_WRITE_WINS` | Gana el `updated_at` más reciente | subjects, courses, assessments, photos, audio |
| `SERVER_WINS` | Siempre gana el servidor | analytics |
| `CLIENT_WINS` | Siempre gana el cliente | schedules, settings |
| `MERGE` | Unión de campos no-nulos | flashcard_decks, flashcards |

## Borrado

- **Soft delete**: `UPDATE subjects SET deleted_at = datetime('now')` + insert en `sync_deletions`
- **RESTORE**: DELETE+CREATE → SyncQueueReducer produce RESTORE → backend upserta + removeDeletion()
- **Cascade**: Delete de subject marca hijos y registra cada uno en `sync_deletions`

## Reducer

### Algoritmo

```
reduce(pending: SyncQueueItem[]) → { operations: ReducedOperation[], report: ReductionReport }

1. Agrupar por (entity_type, entity_id)
2. Por cada grupo, aplicar máquina de estados
3. Ordenar topológicamente por DependencyResolver
4. Validar campos requeridos y existencia de entidades
5. Generar ReductionReport
```

### Máquina de estados

| Secuencia | Resultado |
|---|---|
| CREATE | CREATE |
| UPDATE | UPDATE |
| DELETE | DELETE |
| CREATE+DELETE | no-op |
| DELETE+CREATE | RESTORE |
| UPDATE+UPDATE+UPDATE | UPDATE (merged) |

### Propiedades

- **Determinismo**: `reduce(reduce(q)) === reduce(q)`
- **Idempotencia**: aplicar reducer múltiples veces no cambia el resultado
- **Orden original preservado**: `originalIds` permite rastrear origen

## Códigos de Error del Protocolo

| Código | Significado | Acción del Cliente |
|---|---|---|
| 200 | OK | Eliminar de cola, actualizar lastSyncVersion |
| 400 | Malformed request | Descartar permanentemente |
| 404 | Entity not found | Descartar permanentemente |
| 409 | Stale client (sync_version behind) | Reintentar, re-sync opcional |
| 429 | Rate limited | Retry con backoff exponencial |
| 500 | Server error | Retry hasta 5 |

## Garantías

| Garantía | Descripción |
|---|---|
| **Idempotencia** | `INSERT ... ON CONFLICT(id) DO UPDATE SET` — sin duplicados |
| **Monotonicidad** | `sync_version` solo incrementa |
| **Convergencia** | Mismo `sync_version` → mismo estado |
| **At-least-once** | Reintentos hasta 5 veces |
| **Orden causal** | DependencyResolver ordena CREATEs padres antes que hijos |

## Entidades Syncables (15)

| Tipo | Prioridad | Asset Pipeline |
|---|---|---|
| subject | 1 | No |
| course | 2 | No |
| flashcard-deck | 3 | No |
| flashcard | 4 | No |
| assessment | 5 | No |
| assessment-category | 5 | No |
| schedule | 6 | No |
| calendar-event | 7 | No |
| grading-period | 8 | No |
| lms-account | 8 | No |
| threshold-override | 8 | No |
| study-session | 9 | No |
| photo | 10 | Sí |
| audio-recording | 10 | Sí |
| scanned-document | 10 | Sí |

## Seguridad

- JWT en header `Authorization: Bearer <token>`
- Cada endpoint valida `req.user.id` contra `user_id` en queries
- `sync_version` guard previene escrituras obsoletas
- SQLite como única fuente de verdad para datos de negocio
- MMKV reservado para JWT, tokens, flags, configuración, metadatos

## Migración de v0 a v1.0

1. **Schema**: migration v21 agrega `version_number`, `last_modified_by`, `deleted_at`
2. **Dual Write**: backend escribe sync_version + columnas legacy
3. **Delta Sync**: migrado a `WHERE sync_version > ?`
4. **Test Validation**: Convergence Suite (10/10) + Stress Suite (1000×3 PASS)
5. **Cleanup**: cero decisiones de sync dependen de `deleted_at`
