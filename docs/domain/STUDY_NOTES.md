# StudyNote — Especificación de Dominio

**Estado**: Frozen (v1)
**Última actualización**: Jul 2026
**Responsable**: Domain Layer

---

## Definición

StudyNote es la representación canónica de cualquier contenido capturado por el usuario durante su proceso de aprendizaje.

Una StudyNote **no** es un "scratch pad" ni un "apunte temporal". Es el activo principal del conocimiento del usuario. Todo lo demás — flashcards, quizzes, resúmenes — es un producto derivado.

## Canonical Source

`StudyNote.content` es la única fuente canónica del contenido textual.

- Toda representación derivada debe poder reconstruirse a partir de él.
- `ai_summary` es un cache regenerable, no una fuente alternativa.
- Las flashcards son productos derivados, no versiones editadas.
- Si un día `ai_summary` desaparece, la nota sigue existiendo.

Este principio evita que alguien edite directamente `ai_summary`, modifique flashcards como si fueran el contenido original, o trate cualquier representación derivada como la fuente de verdad.

## Identity

La identidad de una StudyNote está determinada exclusivamente por `id`.

- `id` se asigna en el cliente (UUID v4) y nunca cambia.
- El contenido, título, subject y metadata pueden cambiar.
- La identidad nunca cambia.
- Durante sincronización, `id` es la clave de deduplicación.

Parece obvio. Pero evita errores durante sincronización, backup/restore y merge.

## Design Goals

- **Local First** — La nota existe en SQLite antes de cualquier sincronización.
- **Offline First** — Crear, editar y consultar notas no requiere red.
- **Sync-friendly** — Participa en Initial Sync, Delta Sync y Push.
- **AI-first** — Procesamiento por IA como flujo de primera clase, no como Feature toggle.
- **Extensible** — Artefactos de salida viven en entidades separadas.
- **Immutable identifiers** — `id` se asigna en el cliente y nunca cambia.

**Regla de Offline First**: Una StudyNote nunca depende del procesamiento IA para existir. La creación de la nota siempre debe completarse aunque falle cualquier servicio de IA.

## Non Goals

StudyNote **no** pretende ser:

- Un editor colaborativo.
- Un sistema de versionado de documentos.
- Un sistema de almacenamiento multimedia generalista.
- Un reemplazo de un gestor documental.
- Un sustituto de una base de conocimiento con embeddings.

## Aggregate Root

StudyNote es el Aggregate Root del dominio de captura de conocimiento.

- Toda modificación relacionada con una nota debe iniciarse desde StudyNote.
- Ninguna entidad derivada puede modificar directamente el contenido original.
- Las entidades derivadas (flashcards, quizzes, etc.) son productos, no propietarios del contenido.
- Las entidades derivadas pueden desaparecer sin afectar la existencia de StudyNote.
- StudyNote nunca depende de una entidad derivada para mantenerse consistente.

## Responsabilidad única

Una StudyNote almacena:

- El contenido textual del apunte (o vacío si es solo multimedia)
- Los adjuntos multimedia asociados (Media Manifest)
- El origen y la fuente del contenido
- El estado de procesamiento IA (draft → completed)
- Metadatos para IA (resumen, keywords)
- Información de UX (última apertura)

Una StudyNote **nunca** almacena directamente:

- Flashcards derivadas
- Quizzes generados
- Resúmenes producidos por IA
- Mapas mentales
- Podcasts
- Cualquier otro artefacto de salida

Esas relaciones se realizan mediante entidades independientes (`note_outputs` o entidades específicas por tipo).

## Source vs Origin

Estos dos campos parecen similares pero tienen responsabilidades completamente distintas.

`source` identifica la **categoría técnica** desde la cual fue creada la nota. Determina comportamiento de la aplicación.

| source | Descripción |
|--------|-------------|
| `manual` | Escrito directamente por el usuario |
| `camera` | Fotografía de pizarra, cuaderno, etc. |
| `pdf` | Importado desde un documento PDF |
| `youtube` | Extraído desde un video de YouTube |
| `audio` | Grabación de voz o podcast |
| `web` | Artículo o página web |
| `ai` | Generado completamente por IA |
| `import` | Importado desde otra fuente externa |

`source` es inmutable después de creada.

**Excepción**: Migraciones de dominio explícitamente versionadas (ej: migrar notas de `import` → `pdf` en una versión controlada del esquema).

`origin` identifica la **referencia humana** del contenido. Es información contextual para el usuario. Nunca determina comportamiento. Es **opcional** — una nota manual puede no tener origen.

| origin (ejemplos) | source |
|---------------------|--------|
| "Clase 12" | `manual` |
| "Linear Algebra.pdf" | `pdf` |
| "https://youtu.be/..." | `youtube` |
| "Prof. Gómez" | `audio` |
| "Libro Stewart - Cap. 5" | `import` |
| *(nulo)* | `manual` |

**Regla crítica**: `if (origin === "youtube")` es un anti-pattern. Siempre usar `if (source === "youtube")`.

## Invariants

Una StudyNote debe cumplir estas reglas en todo momento:

| Invariante | Razón |
|------------|-------|
| `id` es inmutable. | Identificador global, asignado en cliente. |
| `created_at` nunca cambia. | Auditoría. |
| `updated_at` cambia en cada modificación de contenido o metadata persistida. | Nunca se actualiza únicamente por lectura. |
| `source` nunca cambia después de creada. | La fuente técnica es un hecho. Excepción: migraciones versionadas. |
| `origin` es opcional. | Nunca asumir que existe. |
| `processing_state` solo puede avanzar. | Ver máquina de estados. |
| `media_paths` (Media Manifest) nunca contiene entradas duplicadas. | Integridad. |
| `ai_keywords` siempre están normalizadas. | Lowercase, sin duplicados. |
| `ai_summary` no excede 1000 caracteres. | Límite de diseño. |
| `content` es inmutable por procesos automáticos. | Ver Inmutabilidad del Contenido. |

## Inmutabilidad del Contenido

`content` representa el contenido original capturado por el usuario.

- Nunca es sobrescrito por procesos automáticos.
- Las transformaciones (resúmenes, análisis, extracción) viven en entidades derivadas o en campos de IA (`ai_summary`, `ai_keywords`).
- Si el usuario modifica `content`, los campos de IA (`ai_summary`, `ai_keywords`) quedan **invalidados** y deben recalcularse.

**Razón**: Evita que el contenido original sea reemplazado por una transformación. El usuario escribió "A". La IA lo resumió. `content` sigue siendo "A", no el resumen.

## Máquina de estados

### Estado documental

Una nota existe en un estado documental independiente del procesamiento IA:

| Estado | Descripción |
|--------|-------------|
| `active` | En uso, contenido vigente (estado por defecto) |
| `archived` | Dejó de ser relevante pero se conserva |
| `deleted` | Soft delete via `deleted_at` |

El primer estado documental es implícitamente `active`. No existe `draft` documental — la nota existe o no existe.

### Estado de IA (`processing_state`)

**Importante**: `processing_state` describe el estado del procesamiento IA. No describe el estado de sincronización ni el estado documental. Son máquinas de estados coexistentes:

- **Document Machine**: active → archived → deleted
- **AI Machine**: draft → queued → processing → completed/failed
- **Sync Machine**: sync_version, sync_queue, cloud_url

Una nota puede estar `archived` + `completed` + sin sincronizar. No conviene mezclarlas.

```
draft
   │
   ▼
queued
   │
   ▼
processing
   ├────────► failed
   │              │
   │              ▼
   └────────── queued
                  │
                  ▼
             processing
```

**Transiciones válidas:**

- `draft` → `queued` (usuario envía a procesar)
- `queued` → `processing` (IA inicia)
- `processing` → `completed` (IA finaliza)
- `processing` → `failed` (IA falla)
- `failed` → `queued` (**solo usuario** — botón "Reintentar procesamiento")

**Transiciones inválidas (prohibidas):**

- `completed` → `processing` (no se re-procesa automáticamente)
- `failed` → `processing` (debe pasar por `queued` primero)
- `completed` → `draft` (el procesamiento no se deshace)
- `draft` → `processing` (debe pasar por `queued` primero)

### Invalidación de IA

Toda modificación del contenido (`content`) invalida `ai_summary` y `ai_keywords`. El procesamiento debe ejecutarse nuevamente para regenerarlos.

`ai_summary` y `ai_keywords` son **cachés regenerables**. Nunca son la fuente de verdad. Si desaparecen, la nota sigue existiendo intacta.

### State Ownership

El único componente autorizado para modificar `processing_state` es el caso de uso encargado del pipeline de IA (Application Layer / Domain Service).

- La UI **nunca** modifica directamente este campo.
- El repositorio solo persiste cambios ya validados.
- Toda transición debe pasar por la máquina de estados definida.

Esto garantiza que un `await repository.update(noteId, { processing_state: "completed" })` desde una pantalla cualquiera nunca ocurra.

## Domain Events

StudyNote genera eventos durante su ciclo de vida. No es Event Sourcing — es la definición de qué cosas importantes ocurren en el dominio.

| Evento | Cuándo |
|--------|--------|
| `StudyNoteCreated` | Nueva nota creada |
| `StudyNoteContentUpdated` | Contenido textual modificado |
| `StudyNoteArchived` | Nota archivada por el usuario |
| `StudyNoteDeleted` | Soft delete |
| `StudyNoteProcessingQueued` | Enviada a procesamiento IA |
| `StudyNoteProcessingCompleted` | IA finalizó procesamiento |
| `StudyNoteProcessingFailed` | IA falló en procesamiento |

Estos eventos permiten que Reminder Engine, Search Index, AI, Analytics o futuras funcionalidades reaccionen sin acoplarse a la entidad.

## Campos derivados (no almacenados)

| Campo | Derivable desde |
|-------|----------------|
| `word_count` | `LENGTH(content) - LENGTH(REPLACE(content, ' ', '')) + 1` |
| `image_count` | `JSON_ARRAY_LENGTH(media_paths)` donde type = 'image' |
| `flashcard_count` | `SELECT COUNT(*) FROM flashcards WHERE note_id = ?` |

Estos campos **no** se almacenan en la tabla. Se calculan bajo demanda o se cachean en la capa de presentación si es necesario.

## Media Manifest (`media_paths`)

Conceptualmente es un **manifiesto de recursos**, no una lista de rutas.

```json
[
  {
    "id": "uuid",
    "type": "image | audio | pdf | video | drawing",
    "path": "/documentDirectory/notes/{noteId}/file.ext"
  }
]
```

El manifiesto permite evolucionar sin cambiar el concepto. Campos futuros opcionales: `mime`, `width`, `height`, `duration`, `checksum`.

**Regla de oro**: Las rutas en el Media Manifest son rutas locales del dispositivo. Nunca se sincronizan. El campo `cloud_url` (cuando exista en la entidad de sincronización) es lo que viaja por el protocolo.

## Límites de IA

| Campo | Límite | Razón |
|-------|--------|-------|
| `ai_summary` | 1000 caracteres | Suficiente para búsqueda, contexto y preview. Truncado en espacio más cercano. |
| `ai_keywords` | Normalizadas | Lowercase + sin duplicados. Nunca `["Stack","Heap","Stack"]`. Siempre `["stack","heap"]`. |

## Ownership

```
StudyNote owns:
    - media_paths / Media Manifest (rutas locales, no sincronizadas)

StudyNote references:
    - Subject (subject_id nullable — "Sin clasificar")

StudyNote is referenced by:
    - note_outputs (Future: flashcard_decks, quizzes, summaries, ...)
```

**Cascade**: Si un Subject se elimina, `subject_id` en StudyNote se pone a NULL (ON DELETE SET NULL). La nota sobrevive.

**Regla**: StudyNote no duplica información que ya existe en Subject. No almacena `course_name`, `subject_name`, `teacher_name`. Esa información se obtiene vía JOIN con Subject cuando se necesita.

## Consistency Rules

| Regla | Razón |
|-------|-------|
| `subject_id` puede ser null. | Una nota puede existir sin clasificar. |
| Si `subject_id` existe, debe referenciar un Subject válido. | Integridad referencial. |
| `media_paths` nunca referencia archivos inexistentes. | Integridad de datos. |
| `deleted_at` implica que la entidad no debe mostrarse en consultas normales. | Soft delete. |
| `updated_at` siempre es `>= created_at`. | Cronología. |
| Una StudyNote completada debe contener al menos una fuente de información: `content` o `media_paths`. | Soporta notas exclusivamente visuales o de audio. |
| `ai_summary` es null o vacío cuando `processing_state` es `draft`. | No hay resumen sin procesamiento. |
| `updated_at` solo cambia por escritura, nunca por lectura. | Evita romper ordenamientos. |

## Query Guidelines

Las consultas por defecto:

- Excluyen `deleted_at IS NOT NULL`.
- Ordenan por `last_opened_at DESC` (UX: "Recientes").
- Búscan en `content` + `ai_summary` + `ai_keywords`.
- Nunca dependen de `media_paths` para ordenar.
- Filtran por `subject_id` cuando la nota pertenece a una materia.
- Muestran "Sin clasificar" cuando `subject_id` es null.
- **Nunca modifican `processing_state` ni metadata.** Toda transición de estado ocurre mediante comandos explícitos (CQRS).

**`last_opened_at`** es un campo de **UX**, no de auditoría. Indica cuándo el usuario abrió la nota por última vez. No confundir con `updated_at` (auditoría de escritura).

## Ciclo de vida

```
Create
   │
   ▼
Active (offline-first, existe en SQLite)
   │
   ▼
Queued (pendiente de procesamiento IA)
   │
   ▼
Processing (IA activa)
   │
   ├────────► Failed (retry manual → queued)
   │
   ▼
Completed (contenido procesado)
   │
   ▼
User studies → Genera outputs (flashcards, quizzes, ...)
   │
   ▼
Archived (opcional, cuando deja de ser relevante)
   │
   ▼
Deleted (soft delete via deleted_at)
```

## Relaciones

```
Subject
    │
    ├── StudyNote (subject_id nullable — "Sin clasificar")
    │
    └── [Future: note_outputs]
            │
            ├── FlashcardDeck
            ├── Quiz
            ├── Summary
            ├── MindMap
            └── Podcast
```

**Regla**: `subject_id` es nullable. Una nota puede existir sin clasificar. La UI muestra "Sin clasificar" como Apple Notes o Notion. El dominio no fuerza carpetas ficticias como "General", "Inbox" o "Default".

## Lo que NO entra en esta entidad

Cada nueva idea debe evaluarse contra esta pregunta:

> ¿Esta información describe **qué es** la nota, o **qué produjo** la nota?

Si es lo segundo, no va aquí. Va en una entidad independiente.

## Anti-patterns

- ❌ Agregar columnas para nuevos artefactos (`quiz_id`, `podcast_path`, `mindmap_path`).
- ❌ Usar `origin` para lógica de negocio.
- ❌ Guardar datos derivados (`word_count`, `image_count`, `flashcard_count`).
- ❌ Acoplar FSRS con StudyNote.
- ❌ Hacer que la IA modifique el contenido original.
- ❌ Agregar columnas por anticipación ("podría necesitarse").
- ❌ Duplicar información que ya existe en Subject (`course_name`, `subject_name`, `teacher_name`).

## Evolución del modelo

```
Course
    │
Subject
    │
Study Note ← Centro del conocimiento
    │
───────────────────────────
│          │          │
Summary    Quiz    Flashcards
│          │          │
AI Chat  Review   FSRS
```

El centro deja de ser el mazo. El centro es el conocimiento capturado. Las herramientas de estudio son derivadas de él.

## Open Questions (pendientes para v2)

- Versionado interno de notas
- Historial de ediciones
- Colaboración
- Compartir notas
- OCR incremental
- Embeddings locales

Estas ideas **no** se implementan como columnas improvisadas. Cada una requiere un diseño explícito antes de entrar al dominio.

## Documentos relacionados

- `SYNC_PROTOCOL.md` — Protocolo de sincronización (study_notes participa como entidad sincronizable)
- `FEATURE_MATRIX.md` — Ciclo de vida completo de la entidad
- `OWNERSHIP_MATRIX.md` — Relaciones de propiedad y cascade
