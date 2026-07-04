# Sync Engine

## Visión General

El Sync Engine es el corazón de Threshold. Garantiza que múltiples dispositivos converjan al mismo estado de datos mediante un protocolo de versionado estricto.

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

## Ciclo de Sync

Cada ciclo: **Push queue → Pull delta → Verificar convergencia**

### Push (upload)

1. **Enqueue**: operación se guarda en `sync_queue` local con status `pending`
2. **Reduce**: `SyncQueueReducer` compacta operaciones por `(entity_type, entity_id)`:

   | Secuencia | Resultado |
   |-----------|-----------|
   | `CREATE` | `CREATE` |
   | `UPDATE` | `UPDATE` |
   | `DELETE` | `DELETE` |
   | `CREATE+DELETE` | no-op |
   | `DELETE+CREATE` | `RESTORE` |
   | `UPDATE+UPDATE+UPDATE` | `UPDATE` (merged) |

3. **Orden topológico**: `DependencyResolver` ordena por tipo: `subject > course > flashcard-deck > flashcard > ...`
4. **Execute**: HTTP request al backend con headers `Authorization: Bearer <jwt>`, `X-Trace-Id: <guid>`
5. **Response**: 2xx → eliminar de cola; 409 → reintentar; 400/404 → descartar; 5xx → retry (max 5)

### Pull (download)

**Initial Sync**: `GET /api/sync/initial` — devuelve todas las entidades del usuario (10 categorías)

**Delta Sync**: `GET /api/sync/delta?version=<lastSyncVersion>` — 15 tablas regulares + 1 especial + sync_deletions

## Versionado

### sync_version (mutaciones)

- **Global**: tabla `sync_version(id=1, version INTEGER)`
- **Per-row**: columna `sync_version` en cada tabla syncable
- **Guard en UPDATE**: backend rechaza con 409 si sync_version del cliente es menor al actual
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

## Queue Reducer

Propósito: eliminar operaciones redundantes antes de enviarlas al backend.

**Algoritmo**:
1. Agrupar por `(entity_type, entity_id)`
2. Aplicar máquina de estados por grupo
3. Ordenar topológicamente por DependencyResolver
4. Validar campos requeridos y existencia de entidades

**Propiedades**: Determinismo (`reduce(reduce(q)) === reduce(q)`), idempotencia, orden preservado.

## Garantías del Protocolo

| Garantía | Descripción |
|---|---|
| **Idempotencia** | `INSERT ... ON CONFLICT(id) DO UPDATE SET` — múltiples envíos no duplican |
| **Monotonicidad** | `sync_version` solo incrementa |
| **Convergencia** | Dos dispositivos con mismo `sync_version` tienen mismo estado |
| **At-least-once** | Reintentos hasta 5 veces |
| **Orden causal** | CREATEs de padres antes que CREATEs de hijos (DependencyResolver) |

## Entidades Syncables (15)

| Tipo | Prioridad | Asset Pipeline |
|---|---|---|
| subject, course, flashcard-deck, flashcard | 1-4 | No |
| assessment, assessment-category, schedule | 5-6 | No |
| calendar-event, grading-period, lms-account | 7-8 | No |
| threshold-override, study-session | 8-9 | No |
| photo, audio-recording, scanned-document | 10 | Sí |

## Más Información

Ver [Sync Protocol v1.0](/sync-protocol) para detalles completos del protocolo.
